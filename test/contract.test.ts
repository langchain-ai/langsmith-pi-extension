import { expect, it, vi } from "vitest";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import extension from "../src/index";
import { mockClient } from "./utils/mock_client";
import { getAssumedTreeFromCalls } from "./utils/tree";

vi.stubEnv("TRACE_TO_LANGSMITH", "true");

const THREAD_ID = "sess_contract_test_123";

// Drive one turn (root -> turn -> llm + tool) with a ctx that exposes
// sessionManager, so we can assert the full contract on a mocked trace.
async function driveOneTurn(init: (api: ExtensionAPI) => Promise<void>) {
  const handlers: Record<
    string,
    Array<(arg: unknown, ctx: ExtensionContext) => Promise<void>>
  > = {};
  const pi = {
    on: (name: string, handler: (arg: unknown, ctx: ExtensionContext) => Promise<void>) => {
      (handlers[name] ??= []).push(handler);
    },
    registerCommand: vi.fn(),
  } as unknown as ExtensionAPI;

  await init(pi);

  const ctx = {
    ui: { setStatus: vi.fn(), notify: vi.fn() },
    cwd: process.cwd(),
    model: { provider: "anthropic", name: "Claude Opus 4.8" },
    sessionManager: { getSessionId: () => THREAD_ID },
    getContextUsage: () => undefined,
  } as unknown as ExtensionContext;

  const fire = async (name: string, arg: unknown) => {
    for (const handler of handlers[name] ?? []) await handler(arg, ctx);
  };

  await fire("before_agent_start", { prompt: "hello", images: [] });
  await fire("turn_start", { turnIndex: 0, timestamp: 1 });
  await fire("before_provider_request", {
    payload: { messages: [{ role: "user", content: "hi" }] },
  });
  await fire("message_end", {
    message: {
      role: "assistant",
      stopReason: "stop",
      content: [{ type: "text", text: "ok" }],
      usage: { input: 10, output: 5, totalTokens: 15 },
    },
  });
  await fire("tool_execution_start", {
    toolCallId: "call_1",
    toolName: "bash",
    args: { command: "ls" },
  });
  await fire("tool_execution_end", {
    toolCallId: "call_1",
    toolName: "bash",
    result: { content: "files" },
    isError: false,
  });
  await fire("turn_end", {
    turnIndex: 0,
    message: { role: "assistant", stopReason: "stop", content: [] },
    toolResults: [],
  });
  await fire("agent_end", { messages: [{ role: "assistant", stopReason: "stop", content: [] }] });
}

it("emits the coding-agent-v1 contract on every run type", async () => {
  const { client, callSpy } = mockClient();

  await driveOneTurn((pi) => extension(pi, { client }));
  await client.awaitPendingTraceBatches();

  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);

  const metaByName = (prefix: string): Record<string, unknown> => {
    const entry = Object.entries(tree.data).find(([name]) => name.startsWith(prefix));
    if (!entry) throw new Error(`no run found for "${prefix}" (have: ${Object.keys(tree.data)})`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((entry[1] as any).extra?.metadata ?? {}) as Record<string, unknown>;
  };

  const root = metaByName("Pi agent run:");
  const turn = metaByName("Pi turn 0:");
  const llm = metaByName("anthropic:");
  const tool = metaByName("bash:");

  // ── Identity block — required on every run (root stamps, children inherit).
  for (const md of [root, turn, llm, tool]) {
    expect(md.ls_agent_kind).toBe("coding_agent");
    expect(md.ls_integration).toBe("pi");
    expect(md.ls_agent_runtime).toBe("Pi");
    expect(md.ls_trace_schema_version).toBe("coding-agent-v1");
    expect(md.thread_id).toBe(THREAD_ID);

    // Versions — required where known.
    expect(typeof md.ls_integration_version).toBe("string");
    expect(typeof md.ls_agent_runtime_version).toBe("string");

    // Workspace.
    expect(typeof md.cwd).toBe("string");

    // Scope-restricted keys must never leak onto runs.
    expect(md).not.toHaveProperty("approval_policy");
    expect(md).not.toHaveProperty("ls_subagent_id");
    expect(md).not.toHaveProperty("ls_subagent_type");
  }

  // ── Git/repo — present because the test runs inside this git repo.
  expect(typeof root.git_branch).toBe("string");
  expect(typeof root.git_commit_sha).toBe("string");
  if (root.repository_provider != null) {
    expect(["github", "gitlab", "bitbucket", "other"]).toContain(root.repository_provider);
    expect(typeof root.repository_url).toBe("string");
    expect(typeof root.repository_name).toBe("string");
  }
  // Git/repo propagates to descendants.
  expect(llm.git_commit_sha).toBe(root.git_commit_sha);
  expect(tool.repository_name).toBe(root.repository_name);

  // ── turn_number — 1-based USER turn, stamped on the root and inherited.
  expect(root.turn_number).toBe(1);
  expect(turn.turn_number).toBe(1);
  expect(llm.turn_number).toBe(1);
  expect(tool.turn_number).toBe(1);
  // The inner-loop index is preserved separately, never as turn_number.
  expect(turn.pi_loop_index).toBe(0);

  // ── Preserved model/tool conventions.
  expect(llm.ls_provider).toBe("anthropic");
  expect(typeof llm.ls_model_name).toBe("string");
  expect(llm.usage_metadata).toBeTruthy();

  // ── ls_tool_name omitted: pi's run name already IS the native tool name.
  expect(tool).not.toHaveProperty("ls_tool_name");
});

it("increments turn_number per user prompt within a thread", async () => {
  const { client, callSpy } = mockClient();

  // Register once, then fire two user prompts so the counter persists.
  const handlers: Record<
    string,
    Array<(arg: unknown, ctx: ExtensionContext) => Promise<void>>
  > = {};
  const pi = {
    on: (name: string, handler: (arg: unknown, ctx: ExtensionContext) => Promise<void>) => {
      (handlers[name] ??= []).push(handler);
    },
    registerCommand: vi.fn(),
  } as unknown as ExtensionAPI;
  await extension(pi, { client });

  const ctx = {
    ui: { setStatus: vi.fn(), notify: vi.fn() },
    cwd: process.cwd(),
    model: { provider: "anthropic", name: "Claude Opus 4.8" },
    sessionManager: { getSessionId: () => THREAD_ID },
    getContextUsage: () => undefined,
  } as unknown as ExtensionContext;
  const fire = async (name: string, arg: unknown) => {
    for (const handler of handlers[name] ?? []) await handler(arg, ctx);
  };

  // Two user prompts, each a minimal root -> agent_end cycle.
  for (const prompt of ["first", "second"]) {
    await fire("before_agent_start", { prompt, images: [] });
    await fire("agent_end", { messages: [{ role: "assistant", stopReason: "stop", content: [] }] });
  }
  await client.awaitPendingTraceBatches();

  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);
  const rootTurnNumbers = Object.entries(tree.data)
    .filter(([name]) => name.startsWith("Pi agent run:"))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map(([, run]) => (run as any).extra?.metadata?.turn_number);

  expect(rootTurnNumbers).toEqual([1, 2]);
});
