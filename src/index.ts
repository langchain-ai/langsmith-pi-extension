import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Client, RunTree } from "langsmith";

import { type Config, getConfig } from "./config";

const EXTENSION_NAME = "langsmith-pi-extension";
const STATUS_KEY = "langsmith";

const PARENT_DOTTED_ORDER_ENV = "LANGSMITH_PI_PARENT_DOTTED_ORDER";
const PARENT_BAGGAGE_ENV = "LANGSMITH_PI_PARENT_BAGGAGE";

interface ActiveTrace {
  root: RunTree;
  turns: Map<number, RunTree>;
  currentTurn?: RunTree;
  currentLlm?: RunTree;
  tools: Map<string, RunTree>;
  envRestores: Map<string, { dottedOrder?: string; baggage?: string }>;
  posted: WeakSet<RunTree>;
  ended: WeakSet<RunTree>;
}

type ReplicaConfig = NonNullable<Config["replicas"]>[number];

function clientConfig(config: Config): ConstructorParameters<typeof Client>[0] {
  return {
    ...(config.api_key ? { apiKey: config.api_key } : {}),
    ...(config.api_url ? { apiUrl: config.api_url } : {}),
  };
}

function runReplicas(config: Config):
  | Array<{
      apiUrl?: string;
      apiKey?: string;
      projectName?: string;
      updates?: Record<string, unknown>;
    }>
  | undefined {
  if (!config.replicas?.length) return undefined;
  return config.replicas.map((replica: ReplicaConfig) => ({
    ...(replica.api_url ? { apiUrl: replica.api_url } : {}),
    ...(replica.api_key ? { apiKey: replica.api_key } : {}),
    ...(replica.project ? { projectName: replica.project } : {}),
    ...(replica.updates ? { updates: replica.updates } : {}),
  }));
}

function modelName(ctxModel: unknown): string | undefined {
  const model = ctxModel as { provider?: string; id?: string; name?: string } | undefined;
  if (!model) return undefined;
  return [model.provider, model.id ?? model.name].filter(Boolean).join("/") || undefined;
}

async function safePost(trace: ActiveTrace, run: RunTree): Promise<void> {
  if (trace.posted.has(run)) return;
  trace.posted.add(run);
  await run.postRun();
}

async function safeEnd(
  trace: ActiveTrace,
  run: RunTree | undefined,
  outputs?: Record<string, unknown>,
  error?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  if (!run || trace.ended.has(run)) return;
  trace.ended.add(run);

  await run.end(outputs, error, undefined, metadata);
  await run.patchRun();
}

function isPiSubagentChild(): boolean {
  return process.env.PI_SUBAGENT_CHILD === "1";
}

function subagentMetadata(): Record<string, unknown> {
  if (!isPiSubagentChild()) return {};
  return {
    piSubagent: true,
    subagentRunId: process.env.PI_SUBAGENT_RUN_ID,
    subagentAgent: process.env.PI_SUBAGENT_CHILD_AGENT,
    subagentIndex: process.env.PI_SUBAGENT_CHILD_INDEX,
    subagentDepth: process.env.PI_SUBAGENT_DEPTH,
  };
}

function parentRunFromEnv(client: Client): RunTree | undefined {
  const dottedOrder = process.env[PARENT_DOTTED_ORDER_ENV];
  if (!dottedOrder) return undefined;
  return RunTree.fromHeaders(
    { "langsmith-trace": dottedOrder, baggage: process.env[PARENT_BAGGAGE_ENV] ?? "" },
    { client },
  );
}

function createRootRun(
  client: Client,
  extensionConfig: Config,
  prompt: string,
  imageCount: number,
  cwd: string,
): RunTree {
  const config = {
    name: isPiSubagentChild()
      ? `Pi subagent run${process.env.PI_SUBAGENT_CHILD_AGENT ? `: ${process.env.PI_SUBAGENT_CHILD_AGENT}` : ""}`
      : "Pi agent run",
    run_type: "chain",
    project_name: extensionConfig.project,
    client,
    inputs: { prompt, imageCount },
    metadata: {
      ls_integration: EXTENSION_NAME,
      cwd,
      ...extensionConfig.metadata,
      ...subagentMetadata(),
    },
    tags: ["pi", "coding-agent", ...(isPiSubagentChild() ? ["pi-subagent"] : [])],
    replicas: runReplicas(extensionConfig),
  };

  const parentRun = parentRunFromEnv(client);
  return parentRun ? parentRun.createChild(config) : new RunTree(config);
}

function setTraceParentEnv(trace: ActiveTrace, toolCallId: string, run: RunTree): void {
  const headers = run.toHeaders();
  trace.envRestores.set(toolCallId, {
    dottedOrder: process.env[PARENT_DOTTED_ORDER_ENV],
    baggage: process.env[PARENT_BAGGAGE_ENV],
  });
  process.env[PARENT_DOTTED_ORDER_ENV] = headers["langsmith-trace"];
  process.env[PARENT_BAGGAGE_ENV] = headers.baggage;
}

function restoreTraceParentEnv(trace: ActiveTrace, toolCallId: string): void {
  const previous = trace.envRestores.get(toolCallId);
  if (!previous) return;
  trace.envRestores.delete(toolCallId);
  if (previous.dottedOrder === undefined) delete process.env[PARENT_DOTTED_ORDER_ENV];
  else process.env[PARENT_DOTTED_ORDER_ENV] = previous.dottedOrder;
  if (previous.baggage === undefined) delete process.env[PARENT_BAGGAGE_ENV];
  else process.env[PARENT_BAGGAGE_ENV] = previous.baggage;
}

export default async function (pi: ExtensionAPI) {
  const config = await getConfig();
  const enabled = config.enabled;
  const client = enabled ? new Client(clientConfig(config)) : undefined;
  let active: ActiveTrace | undefined;

  pi.on("session_start", async (_event, ctx) => {
    if (enabled) {
      ctx.ui.setStatus(STATUS_KEY, "LangSmith: tracing");
    } else {
      ctx.ui.setStatus(STATUS_KEY, "LangSmith: disabled");
    }
  });

  pi.registerCommand("langsmith-tracing", {
    description: "Show LangSmith tracing status for this Pi session",
    handler: async (_args, ctx) => {
      const message = enabled
        ? `LangSmith tracing is enabled${active ? ` (active trace ${active.root.id})` : ""}.`
        : "LangSmith tracing is disabled. Set TRACE_TO_LANGSMITH=true and configure LANGSMITH_PI_API_KEY (or LANGSMITH_PI_ENDPOINT for self-hosted) to enable it.";
      ctx.ui.notify(message, enabled ? "info" : "warning");
    },
  });

  if (!enabled || !client) return;

  pi.on("before_agent_start", async (event, ctx) => {
    if (active) {
      await safeEnd(
        active,
        active.root,
        { interruptedByNextRun: true },
        "Trace replaced by a new Pi run",
      );
    }

    active = {
      root: createRootRun(client, config, event.prompt, event.images?.length ?? 0, ctx.cwd),
      turns: new Map(),
      tools: new Map(),
      envRestores: new Map(),
      posted: new WeakSet(),
      ended: new WeakSet(),
    };
    await safePost(active, active.root);
    ctx.ui.setStatus(STATUS_KEY, "LangSmith: tracing run");
  });

  pi.on("turn_start", async (event, ctx) => {
    if (!active) return;
    const turn = active.root.createChild({
      name: `Pi turn ${event.turnIndex}`,
      run_type: "chain",
      inputs: { turnIndex: event.turnIndex },
      metadata: { model: modelName(ctx.model), timestamp: event.timestamp },
    });
    active.turns.set(event.turnIndex, turn);
    active.currentTurn = turn;
    await safePost(active, turn);
  });

  pi.on("before_provider_request", async (event, ctx) => {
    if (!active) return;
    const parent = active.currentTurn ?? active.root;
    const llm = parent.createChild({
      name: modelName(ctx.model) ?? "provider request",
      run_type: "llm",
      inputs: { payload: event.payload },
      metadata: { model: modelName(ctx.model) },
    });
    active.currentLlm = llm;
    await safePost(active, llm);
  });

  pi.on("after_provider_response", async (event) => {
    if (!active?.currentLlm) return;
    active.currentLlm.addEvent({
      name: "provider_response",
      kwargs: { status: event.status, headers: event.headers },
    });
  });

  pi.on("message_end", async (event) => {
    if (!active || event.message.role !== "assistant" || !active.currentLlm) return;
    const error =
      event.message.stopReason === "error"
        ? (event.message.errorMessage ?? "Assistant message ended with stopReason=error")
        : undefined;
    await safeEnd(active, active.currentLlm, { message: event.message }, error, {
      stopReason: event.message.stopReason,
      usage: event.message.usage,
    });
    active.currentLlm = undefined;
  });

  pi.on("tool_execution_start", async (event) => {
    if (!active) return;
    const parent = active.currentTurn ?? active.root;
    const tool = parent.createChild({
      name: event.toolName,
      run_type: "tool",
      inputs: { toolCallId: event.toolCallId, args: event.args },
      metadata: { toolName: event.toolName, toolCallId: event.toolCallId },
    });
    active.tools.set(event.toolCallId, tool);
    if (event.toolName === "subagent") {
      setTraceParentEnv(active, event.toolCallId, tool);
    }
    await safePost(active, tool);
  });

  pi.on("tool_execution_update", async (event) => {
    const tool = active?.tools.get(event.toolCallId);
    if (!tool) return;
    tool.addEvent({
      name: "tool_update",
      kwargs: { partialResult: event.partialResult },
    });
  });

  pi.on("tool_execution_end", async (event) => {
    if (!active) return;
    const tool = active.tools.get(event.toolCallId);
    if (!tool) return;
    active.tools.delete(event.toolCallId);
    restoreTraceParentEnv(active, event.toolCallId);
    await safeEnd(
      active,
      tool,
      { result: event.result },
      event.isError ? "Tool execution failed" : undefined,
      { isError: event.isError },
    );
  });

  pi.on("turn_end", async (event) => {
    if (!active) return;
    const turn = active.turns.get(event.turnIndex) ?? active.currentTurn;
    await safeEnd(active, active.currentLlm, { message: event.message });
    active.currentLlm = undefined;
    await safeEnd(active, turn, {
      message: event.message,
      toolResults: event.toolResults,
    });
    if (turn === active.currentTurn) active.currentTurn = undefined;
  });

  pi.on("agent_end", async (event, ctx) => {
    if (!active) return;
    for (const tool of active.tools.values()) {
      await safeEnd(active, tool, undefined, "Pi run ended before tool_execution_end");
    }
    active.tools.clear();
    for (const toolCallId of [...active.envRestores.keys()]) {
      restoreTraceParentEnv(active, toolCallId);
    }
    await safeEnd(
      active,
      active.currentLlm,
      undefined,
      "Pi run ended before LLM message finalized",
    );
    for (const turn of active.turns.values()) {
      await safeEnd(active, turn, { incomplete: true });
    }

    const root = active.root;
    await safeEnd(active, root, {
      messages: event.messages,
      contextUsage: ctx.getContextUsage(),
    });
    active = undefined;
    ctx.ui.setStatus(STATUS_KEY, "LangSmith: traced");
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    if (active) {
      await safeEnd(
        active,
        active.root,
        { shutdown: true },
        "Pi session shut down before run completed",
      );
      for (const toolCallId of [...active.envRestores.keys()]) {
        restoreTraceParentEnv(active, toolCallId);
      }
      active = undefined;
    }
    await client.awaitPendingTraceBatches();
    ctx.ui.setStatus(STATUS_KEY, undefined);
  });
}
