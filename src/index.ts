import type { ContextEvent, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Client, RunTree } from "langsmith";

import { type Config, getConfig } from "./config";
import { isRecord } from "./types";

const EXTENSION_NAME = "langsmith-pi-extension";
const STATUS_KEY = "langsmith";

interface PendingLlmRun {
  name: string;
  payload: unknown;
  metadata: Record<string, unknown>;
}

interface TraceContext {
  root: RunTree;
  turns: Map<number, RunTree>;

  currentTurn?: RunTree;
  currentLlm?: RunTree;
  pendingLlm?: PendingLlmRun;
  deferNextLlmToNextTurn: boolean;

  tools: Map<string, RunTree>;
}

type AgentMessage = ContextEvent["messages"][number];

type ExtractMessage<Role extends string> = AgentMessage extends infer T
  ? T extends { role: Role }
    ? T
    : never
  : never;

const isMessage = <Role extends string>(
  message: AgentMessage,
  role: Role,
): message is ExtractMessage<Role> => {
  return message.role === role;
};

const safeAdd = (...value: Array<number | null | undefined>): number | undefined => {
  let result: number | undefined = undefined;
  for (const v of value) {
    if (v == null) continue;
    result ??= 0;
    result += v;
  }
  return result;
};

const extractUsageMetadata = (message: AgentMessage): Record<string, unknown> | undefined => {
  if (!isMessage(message, "assistant")) return undefined;

  const usage = message.usage;
  return {
    input_tokens: safeAdd(usage?.input, usage?.cacheRead, usage?.cacheWrite),
    input_cost: safeAdd(usage?.cost?.input, usage?.cost?.cacheRead, usage?.cost?.cacheWrite),

    output_tokens: usage?.output,
    output_cost: usage?.cost?.output,

    total_tokens: usage?.totalTokens,
    total_cost: usage?.cost?.total,

    input_token_details: {
      cache_read: usage?.cacheRead,
      cache_creation: usage?.cacheWrite,
    },

    input_cost_details: {
      cache_read: usage?.cost?.cacheRead,
      cache_creation: usage?.cost?.cacheWrite,
    },
  };
};

const MULTIMODAL_PART_TYPES = new Set(["image", "audio", "file", "video"]);

// Pi represents binary content (e.g. images read by the `read` tool, or attached
// by the user) as { type, mimeType, data }. The LangSmith UI does not recognize
// that shape and renders the raw base64 as text. Convert it to the LangChain v1
// multimodal content block ({ type, mime_type, base64 }) which the UI renders
// inline. Anything that is not a recognized multimodal part passes through
// untouched. Provider request payloads are left alone — they already arrive in
// provider-native format (Anthropic source.base64 / OpenAI image_url) that the
// UI handles.
export const normalizeContentPart = (part: unknown): unknown => {
  if (!isRecord(part)) return part;
  if (typeof part.type !== "string" || !MULTIMODAL_PART_TYPES.has(part.type)) return part;
  if (typeof part.mimeType !== "string" || typeof part.data !== "string") return part;

  const { mimeType, data, ...rest } = part;
  return { ...rest, mime_type: mimeType, base64: data };
};

const normalizeContent = (content: unknown): unknown => {
  if (!Array.isArray(content)) return content;
  return content.map(convertContentPart);
};

// Single per-part converter applied to every message role.
// assistant tool calls become LangSmith `tool_call` parts
// multimodal parts are normalized for inline rendering
// everything else passes through.
const convertContentPart = (part: unknown): unknown => {
  if (isRecord(part) && part.type === "toolCall") {
    const { arguments: args, type: _, ...rest } = part;
    return { type: "tool_call", args, ...rest };
  }

  return normalizeContentPart(part);
};

export const convertMessages = (messages: AgentMessage[]): Record<string, unknown>[] => {
  return messages.map((message) => {
    let { role, content, ...rest } = message as unknown as Record<string, unknown>;

    if (message.role === "toolResult") {
      role = "tool";
    }

    content = normalizeContent(content);

    return { role, content, ...rest };
  });
};

export const convertToolOutputs = (outputs: { result: unknown }) => {
  if (isRecord(outputs.result) && outputs.result.content != null) {
    return {
      output: {
        role: "tool",
        ...outputs.result,
        content: normalizeContent(outputs.result.content),
      },
    };
  }

  return { output: outputs.result };
};

const convertProviderPayload = (payload: unknown) => {
  if (!isRecord(payload)) return { payload };

  if (Array.isArray(payload.input) && payload.messages == null) {
    const { input, ...rest } = payload;
    return {
      messages: input.flatMap<Record<string, unknown>>((maybe) => {
        if (!isRecord(maybe)) return maybe;

        if (maybe.role === "user" && Array.isArray(maybe.content)) {
          const { role, content, ...rest } = maybe;
          return {
            role,
            content: maybe.content.map((maybePart) => {
              if (!isRecord(maybePart)) return maybePart;

              if (maybePart.type === "input_text") {
                const { type: _, ...restPart } = maybePart;
                return { type: "text", ...restPart };
              }

              return maybePart;
            }),
            ...rest,
          };
        }

        return maybe;
      }),
      ...rest,
    };
  }

  if (Array.isArray(payload.messages)) {
    const { messages, ...rest } = payload;
    return {
      messages: messages.flatMap((maybe) => {
        if (!isRecord(maybe)) return maybe;

        if (Array.isArray(maybe.content)) {
          // Anthropic: Mislabeled tool messages as user messages
          if (
            maybe.role === "user" &&
            maybe.content.length === 1 &&
            maybe.content.every((part) => isRecord(part) && part.type === "tool_result")
          ) {
            const [{ type: __, ...restPart }] = maybe.content;
            const { role: _, ...rest } = maybe;
            return { role: "tool", ...rest, ...restPart };
          }
        }

        return maybe;
      }),
      ...rest,
    };
  }

  return payload;
};

async function startLlmRun(
  trace: TraceContext,
  parent: RunTree,
  pending: PendingLlmRun,
): Promise<RunTree> {
  const llm = parent.createChild({
    name: pending.name,
    run_type: "llm",
    inputs: convertProviderPayload(pending.payload),
    metadata: pending.metadata,
  });

  trace.currentLlm = llm;
  await safePost(llm);
  return llm;
}

async function safePost(run: RunTree): Promise<void> {
  await run.postRun();
}

async function safeEnd(
  run: RunTree | undefined,
  params: {
    outputs?: Record<string, unknown>;
    error?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await run?.end(params.outputs, params.error, undefined, params.metadata);
  await run?.patchRun();
}

function createRootRun(
  client: Client,
  extensionConfig: Config,
  prompt: string,
  imageCount: number,
  cwd: string,
): RunTree {
  const config = {
    name: "Pi agent run",
    run_type: "chain",
    project_name: extensionConfig.project,
    client,
    inputs: { prompt, imageCount },
    metadata: {
      ls_integration: EXTENSION_NAME,
      cwd,
      ...extensionConfig.metadata,
    },
    tags: ["pi", "coding-agent"],
    replicas: extensionConfig.replicas?.map((replica) => ({
      ...(replica.api_url ? { apiUrl: replica.api_url } : {}),
      ...(replica.api_key ? { apiKey: replica.api_key } : {}),
      ...(replica.project ? { projectName: replica.project } : {}),
      ...(replica.updates ? { updates: replica.updates } : {}),
    })),
  };

  return new RunTree(config);
}

export default async function (pi: ExtensionAPI, options?: { client?: Client }) {
  const config = await getConfig();
  const enabled = config.enabled;

  const client = enabled
    ? (options?.client ?? new Client({ apiKey: config.api_key, apiUrl: config.api_url }))
    : undefined;

  let active: TraceContext | undefined;

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
      await safeEnd(active.root, {
        outputs: { interruptedByNextRun: true },
        error: "Trace replaced by a new Pi run",
      });
    }

    active = {
      root: createRootRun(client, config, event.prompt, event.images?.length ?? 0, ctx.cwd),
      turns: new Map(),
      deferNextLlmToNextTurn: false,
      tools: new Map(),
    };
    await safePost(active.root);
    ctx.ui.setStatus(STATUS_KEY, "LangSmith: tracing run");
  });

  pi.on("turn_start", async (event, ctx) => {
    if (!active) return;
    const turn = active.root.createChild({
      name: `Pi turn ${event.turnIndex}`,
      run_type: "chain",
      inputs: { turnIndex: event.turnIndex },
      metadata: {
        ls_provider: ctx.model?.provider,
        ls_model_name: ctx.model?.name?.toLocaleLowerCase(),
        timestamp: event.timestamp,
      },
    });
    active.turns.set(event.turnIndex, turn);
    active.currentTurn = turn;
    active.deferNextLlmToNextTurn = false;
    await safePost(turn);

    if (active.pendingLlm) {
      const pending = active.pendingLlm;
      active.pendingLlm = undefined;
      await startLlmRun(active, turn, pending);
    }
  });

  pi.on("before_provider_request", async (event, ctx) => {
    if (!active) return;
    const pending = {
      name: ctx.model?.provider ?? ctx.model?.name?.toLocaleLowerCase() ?? "provider request",
      payload: event.payload,
      metadata: {
        ls_provider: ctx.model?.provider,
        ls_model_name: ctx.model?.name?.toLocaleLowerCase(),
      },
      providerResponses: [],
    };

    if (active.deferNextLlmToNextTurn) {
      active.pendingLlm = pending;
      return;
    }

    await startLlmRun(active, active.currentTurn ?? active.root, pending);
  });

  pi.on("message_end", async (event) => {
    if (!active || event.message.role !== "assistant" || !active.currentLlm) return;
    const error =
      event.message.stopReason === "error"
        ? (event.message.errorMessage ?? "Assistant message ended with stopReason=error")
        : undefined;

    await safeEnd(active.currentLlm, {
      outputs: { messages: convertMessages([event.message]) },
      error,
      metadata: {
        stop_reason: event.message.stopReason,
        usage_metadata: extractUsageMetadata(event.message),
      },
    });
    active.currentLlm = undefined;
    active.deferNextLlmToNextTurn = true;
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
    await safePost(tool);
  });

  pi.on("tool_execution_update", async (event) => {
    const tool = active?.tools.get(event.toolCallId);
    if (!tool || !active) return;

    tool.addEvent({ name: "tool_update", kwargs: { partialResult: event.partialResult } });
  });

  pi.on("tool_execution_end", async (event) => {
    const tool = active?.tools.get(event.toolCallId);
    if (!tool || !active) return;

    active.tools.delete(event.toolCallId);

    await safeEnd(tool, {
      outputs: convertToolOutputs(event),
      error: event.isError ? "Tool execution failed" : undefined,
    });
  });

  pi.on("turn_end", async (event) => {
    if (!active) return;
    const turn = active.turns.get(event.turnIndex) ?? active.currentTurn;

    await safeEnd(active.currentLlm, {
      outputs: { messages: convertMessages([event.message]) },
      metadata: { usage_metadata: extractUsageMetadata(event.message) },
    });
    active.currentLlm = undefined;

    await safeEnd(turn, {
      outputs: { messages: convertMessages([event.message]), toolResults: event.toolResults },
    });
    if (turn === active.currentTurn) active.currentTurn = undefined;
  });

  pi.on("agent_end", async (event, ctx) => {
    if (!active) return;

    for (const tool of active.tools.values()) {
      await safeEnd(tool, { error: "Pi run ended before tool_execution_end" });
    }
    active.tools.clear();

    if (active.pendingLlm) {
      const pending = active.pendingLlm;
      active.pendingLlm = undefined;
      await startLlmRun(active, active.currentTurn ?? active.root, pending);
    }
    await safeEnd(active.currentLlm, {
      error: "Pi run ended before LLM message finalized",
    });
    for (const turn of active.turns.values()) {
      await safeEnd(turn, { outputs: { incomplete: true } });
    }

    const root = active.root;
    await safeEnd(root, {
      outputs: { messages: convertMessages(event.messages), context_usage: ctx.getContextUsage() },
    });

    active = undefined;
    ctx.ui.setStatus(STATUS_KEY, "LangSmith: traced");
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    if (active) {
      if (active.pendingLlm) {
        const pending = active.pendingLlm;
        active.pendingLlm = undefined;
        await startLlmRun(active, active.currentTurn ?? active.root, pending);
      }
      await safeEnd(active.currentLlm, {
        error: "Pi session shut down before LLM message finalized",
      });
      await safeEnd(active.root, {
        outputs: { shutdown: true },
        error: "Pi session shut down before run completed",
      });

      active = undefined;
    }
    await client.awaitPendingTraceBatches();
    ctx.ui.setStatus(STATUS_KEY, undefined);
  });
}
