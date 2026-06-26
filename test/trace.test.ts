import { expect, it, vi } from "vitest";
import * as fs from "node:fs";
import extension from "../src/index";
import { replayExtension } from "./utils/replay";
import { mockClient } from "./utils/mock_client";
import { asTree, getAssumedTreeFromCalls } from "./utils/tree";

vi.stubEnv("TRACE_TO_LANGSMITH", "true");

it("openai responses", async () => {
  const { client, callSpy } = mockClient();

  await replayExtension(
    (pi) => extension(pi, { client }),
    await fs.promises.readFile(
      new URL("./recordings/oai-responses-tool-calls.jsonl", import.meta.url),
      "utf-8",
    ),
  );

  await client.awaitPendingTraceBatches();
  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);

  const expected = asTree((run) => {
    run`Pi agent run:0`(
      {
        run_type: "chain",
        inputs: { imageCount: 0 },
        extra: { metadata: { ls_integration: "pi" } },
      },
      run`Pi turn 0:1`(
        { run_type: "chain", inputs: { turnIndex: 0 } },
        run`openai:2`({
          run_type: "llm",
          inputs: {
            model: "gpt-5.5",
            stream: true,
            messages: [
              { role: "developer", content: expect.stringContaining("assistant") },
              {
                role: "user",
                content: [{ type: "text", text: "Describe this project for me" }],
              },
            ],
          },
          outputs: {
            messages: [
              expect.objectContaining({
                role: "assistant",
                content: expect.arrayContaining([
                  expect.objectContaining({
                    type: "tool_call",
                    name: "bash",
                    args: { command: "ls" },
                  }),
                ]),
              }),
            ],
          },
          extra: {
            metadata: {
              usage_metadata: {
                input_tokens: 1483,
                output_tokens: 35,
                total_tokens: 1483 + 35,
                input_token_details: { cache_read: 0, cache_creation: 0 },
              },
            },
          },
        }),
        run`bash:3`({ run_type: "tool", inputs: { args: { command: "ls" } } }),
      ),
      run`Pi turn 1:4`(
        { run_type: "chain", inputs: { turnIndex: 1 } },
        run`openai:5`({
          run_type: "llm",
          inputs: {
            messages: expect.arrayContaining([
              expect.objectContaining({
                type: "function_call_output",
                call_id: "call_e5nxz74ErchY1mbRHp4x1d6P",
                output: expect.stringContaining("package.json"),
              }),
            ]),
          },
          outputs: {
            messages: [
              expect.objectContaining({
                role: "assistant",
                content: expect.arrayContaining([
                  expect.objectContaining({
                    type: "tool_call",
                    name: "read",
                    args: { path: "README.md" },
                  }),
                  expect.objectContaining({
                    type: "tool_call",
                    name: "read",
                    args: { path: "package.json" },
                  }),
                  expect.objectContaining({
                    type: "tool_call",
                    name: "bash",
                    args: { command: "find src scripts test -maxdepth 3 -type f | sort" },
                  }),
                ]),
              }),
            ],
          },
          extra: {
            metadata: {
              usage_metadata: {
                input_tokens: 1559,
                output_tokens: 75,
                total_tokens: 1559 + 75,
                input_token_details: { cache_read: 0, cache_creation: 0 },
              },
            },
          },
        }),
        run`read:6`({ run_type: "tool", inputs: { args: { path: "README.md" } } }),
        run`read:7`({ run_type: "tool", inputs: { args: { path: "package.json" } } }),
        run`bash:8`({
          run_type: "tool",
          inputs: { args: { command: "find src scripts test -maxdepth 3 -type f | sort" } },
        }),
      ),
      run`Pi turn 2:9`(
        { run_type: "chain", inputs: { turnIndex: 2 } },
        run`openai:10`({
          run_type: "llm",
          inputs: {
            messages: expect.arrayContaining([
              expect.objectContaining({
                type: "function_call_output",
                call_id: "call_3Azl4cFHdI1HFrL0jwpanhH6",
                output: expect.stringContaining("src/index.ts"),
              }),
            ]),
          },
          outputs: {
            messages: [
              expect.objectContaining({
                role: "assistant",
                content: expect.arrayContaining([
                  expect.objectContaining({
                    type: "tool_call",
                    name: "read",
                    args: { path: "src/index.ts" },
                  }),
                  expect.objectContaining({
                    type: "tool_call",
                    name: "read",
                    args: { path: "src/config.ts" },
                  }),
                  expect.objectContaining({
                    type: "tool_call",
                    name: "read",
                    args: { path: "src/record.ts" },
                  }),
                  expect.objectContaining({
                    type: "tool_call",
                    name: "read",
                    args: { path: "test/replay.test.ts" },
                  }),
                  expect.objectContaining({
                    type: "tool_call",
                    name: "read",
                    args: { path: "langsmith.jsonl", limit: 20 },
                  }),
                ]),
              }),
            ],
          },
          extra: {
            metadata: {
              usage_metadata: {
                input_tokens: 1912,
                output_tokens: 121,
                total_tokens: 1912 + 121,
                input_token_details: { cache_read: 1024, cache_creation: 0 },
              },
            },
          },
        }),
        run`read:11`({ run_type: "tool", inputs: { args: { path: "src/index.ts" } } }),
        run`read:12`({ run_type: "tool", inputs: { args: { path: "src/config.ts" } } }),
        run`read:13`({ run_type: "tool", inputs: { args: { path: "src/record.ts" } } }),
        run`read:14`({ run_type: "tool", inputs: { args: { path: "test/replay.test.ts" } } }),
        run`read:15`({
          run_type: "tool",
          inputs: { args: { path: "langsmith.jsonl", limit: 20 } },
        }),
      ),
      run`Pi turn 3:16`(
        { run_type: "chain", inputs: { turnIndex: 3 } },
        run`openai:17`({
          run_type: "llm",
          inputs: {
            messages: expect.arrayContaining([
              expect.objectContaining({
                type: "function_call_output",
                call_id: "call_ywu3lVGvOy2UJ1HkKTmw41Jv",
                output: expect.stringContaining("session_start"),
              }),
            ]),
          },
          outputs: {
            messages: [
              expect.objectContaining({
                role: "assistant",
                content: expect.arrayContaining([
                  expect.objectContaining({
                    type: "tool_call",
                    name: "bash",
                    args: { command: "find . -maxdepth 2 -type f | sort | sed 's#^./##'" },
                  }),
                ]),
              }),
            ],
          },
          extra: {
            metadata: {
              usage_metadata: {
                input_tokens: 16106,
                output_tokens: 74,
                total_tokens: 16106 + 74,
                input_token_details: { cache_read: 1536, cache_creation: 0 },
              },
            },
          },
        }),
        run`bash:18`({
          run_type: "tool",
          inputs: { args: { command: "find . -maxdepth 2 -type f | sort | sed 's#^./##'" } },
        }),
      ),
      run`Pi turn 4:19`(
        { run_type: "chain", inputs: { turnIndex: 4 } },
        run`openai:20`({
          run_type: "llm",
          inputs: {
            messages: expect.arrayContaining([
              expect.objectContaining({
                type: "function_call_output",
                call_id: "call_Fjd9GgSusFasQkGOpDDhZRhw",
                output: expect.stringContaining("pnpm-lock.yaml"),
              }),
            ]),
          },
          outputs: {
            messages: [
              expect.objectContaining({
                role: "assistant",
                content: expect.arrayContaining([
                  expect.objectContaining({
                    type: "text",
                    text: expect.stringContaining("LangSmith Pi Extension"),
                  }),
                ]),
              }),
            ],
          },
          extra: {
            metadata: {
              usage_metadata: {
                input_tokens: 16290,
                output_tokens: 1858,
                total_tokens: 16290 + 1858,
                input_token_details: { cache_read: 15872, cache_creation: 0 },
              },
            },
          },
        }),
      ),
    );
  });

  expect(tree.nodes).toEqual(expected.nodes);
  expect(tree.edges).toEqual(expected.edges);
  expect(tree.data).toMatchObject(expected.data);
});

it("anthropic", async () => {
  const { client, callSpy } = mockClient();

  await replayExtension(
    (pi) => extension(pi, { client }),
    await fs.promises.readFile(
      new URL("./recordings/anthropic-tool-calls.jsonl", import.meta.url),
      "utf-8",
    ),
  );

  await client.awaitPendingTraceBatches();
  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);

  const expected = asTree((run) => {
    run`Pi agent run:0`(
      {
        run_type: "chain",
        inputs: { imageCount: 0 },
        extra: { metadata: { ls_integration: "pi" } },
      },
      run`Pi turn 0:1`(
        { run_type: "chain", inputs: { turnIndex: 0 } },
        run`anthropic:2`({
          run_type: "llm",
          inputs: {
            model: "claude-opus-4-8",
            stream: true,
            messages: [
              {
                role: "system",
                content: expect.stringContaining("coding assistant"),
                _raw: [{ type: "text", text: expect.stringContaining("coding assistant") }],
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "What's this repo about. Do as many tool calls as possible to be 100% sure.",
                  },
                ],
              },
            ],
          },
          extra: {
            metadata: {
              usage_metadata: {
                input_tokens: 2855,
                output_tokens: 246,
                total_tokens: 3101,
                input_token_details: { cache_read: 2755, cache_creation: 98 },
              },
            },
          },
        }),
        run`bash:3`({
          run_type: "tool",
          inputs: { args: { command: expect.stringContaining("ls -la") } },
        }),
        run`bash:4`({
          run_type: "tool",
          inputs: { args: { command: expect.stringContaining("cat package.json") } },
        }),
        run`bash:5`({
          run_type: "tool",
          inputs: { args: { command: expect.stringContaining("git log") } },
        }),
      ),
      run`Pi turn 1:6`(
        { run_type: "chain", inputs: { turnIndex: 1 } },
        run`anthropic:7`({
          run_type: "llm",
          inputs: {
            messages: [
              { role: "system", content: expect.stringContaining("coding assistant") },
              {
                role: "user",
                content: expect.arrayContaining([
                  expect.objectContaining({
                    type: "text",
                    text: expect.stringContaining("What's this repo about"),
                  }),
                ]),
              },
              {
                role: "assistant",
                content: expect.arrayContaining([
                  expect.objectContaining({ type: "thinking" }),
                  expect.objectContaining({ type: "tool_use" }),
                ]),
              },
              { role: "tool", tool_use_id: expect.stringContaining("toolu_") },
              { role: "tool", tool_use_id: expect.stringContaining("toolu_") },
              { role: "tool", tool_use_id: expect.stringContaining("toolu_") },
            ],
          },
          extra: {
            metadata: {
              usage_metadata: {
                input_tokens: 7351,
                output_tokens: 196,
                total_tokens: 7351 + 196,
                input_token_details: { cache_read: 2853, cache_creation: 4496 },
              },
            },
          },
        }),
        run`bash:8`({
          run_type: "tool",
          inputs: { args: { command: expect.stringContaining("find src") } },
        }),
        run`bash:9`({
          run_type: "tool",
          inputs: { args: { command: expect.stringContaining("head -60 src/index.ts") } },
        }),
      ),
      run`Pi turn 2:10`(
        { run_type: "chain", inputs: { turnIndex: 2 } },
        run`anthropic:11`({
          run_type: "llm",
          inputs: {
            messages: expect.arrayContaining([
              expect.objectContaining({
                role: "tool",
                tool_use_id: expect.stringContaining("toolu_"),
              }),
            ]),
          },
          extra: {
            metadata: {
              usage_metadata: {
                input_tokens: 8537,
                output_tokens: 141,
                total_tokens: 8537 + 141,
                input_token_details: { cache_read: 7349, cache_creation: 1186 },
              },
            },
          },
        }),
        run`read:12`({
          run_type: "tool",
          inputs: { args: { path: "src/index.ts", offset: 60, limit: 200 } },
        }),
        run`read:13`({
          run_type: "tool",
          inputs: { args: { path: "src/config.ts" } },
        }),
      ),
      run`Pi turn 3:14`(
        { run_type: "chain", inputs: { turnIndex: 3 } },
        run`anthropic:15`({
          run_type: "llm",
          inputs: {
            messages: expect.arrayContaining([
              expect.objectContaining({
                role: "tool",
                tool_use_id: expect.stringContaining("toolu_"),
              }),
            ]),
          },
          extra: {
            metadata: {
              usage_metadata: {
                input_tokens: 12669,
                output_tokens: 94,
                total_tokens: 12669 + 94,
                input_token_details: { cache_read: 8535, cache_creation: 4132 },
              },
            },
          },
        }),
        run`read:16`({
          run_type: "tool",
          inputs: { args: { path: "src/index.ts", offset: 260, limit: 220 } },
        }),
      ),
      run`Pi turn 4:17`(
        { run_type: "chain", inputs: { turnIndex: 4 } },
        run`anthropic:18`({
          run_type: "llm",
          inputs: {
            messages: expect.arrayContaining([
              expect.objectContaining({
                role: "tool",
                tool_use_id: expect.stringContaining("toolu_"),
              }),
            ]),
          },
          extra: {
            metadata: {
              usage_metadata: {
                input_tokens: 15583,
                output_tokens: 1035,
                total_tokens: 15583 + 1035,
                input_token_details: { cache_read: 12667, cache_creation: 2914 },
              },
            },
          },
        }),
      ),
    );
  });

  expect(tree.nodes).toEqual(expected.nodes);
  expect(tree.edges).toEqual(expected.edges);
  expect(tree.data).toMatchObject(expected.data);

  for (const [name, run] of Object.entries(tree.data)) {
    if (!name.startsWith("anthropic:")) continue;
    expect(run.inputs).not.toHaveProperty("system");
  }
});

it("gemini", async () => {
  const { client, callSpy } = mockClient();

  await replayExtension(
    (pi) => extension(pi, { client }),
    await fs.promises.readFile(
      new URL("./recordings/gemini-tool-calls.jsonl", import.meta.url),
      "utf-8",
    ),
  );

  await client.awaitPendingTraceBatches();
  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);

  const expected = asTree((run) => {
    run`Pi agent run:0`(
      {
        run_type: "chain",
        inputs: { imageCount: 0 },
        error: expect.stringContaining("Quota exceeded"),
        extra: { metadata: { ls_integration: "pi" } },
      },
      run`Pi turn 0:1`(
        { run_type: "chain", inputs: { turnIndex: 0 } },
        run`google:2`({
          run_type: "llm",
          inputs: {
            model: "gemini-3.5-flash",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "What's this repo about. Do as many tool calls as possible to be 100% sure.",
                  },
                ],
              },
            ],
          },
          outputs: {
            messages: [
              expect.objectContaining({
                role: "assistant",
                content: expect.arrayContaining([
                  expect.objectContaining({
                    type: "tool_call",
                    name: "bash",
                    args: { command: "ls -F" },
                  }),
                ]),
              }),
            ],
          },
          extra: {
            metadata: {
              usage_metadata: {
                input_tokens: 1785,
                output_tokens: 142,
                total_tokens: 1927,
                input_token_details: { cache_read: 0, cache_creation: 0 },
              },
            },
          },
        }),
        run`bash:3`({ run_type: "tool", inputs: { args: { command: "ls -F" } } }),
      ),
      run`Pi turn 1:4`(
        { run_type: "chain", inputs: { turnIndex: 1 } },
        run`google:5`({
          run_type: "llm",
          inputs: {
            messages: [
              expect.objectContaining({
                role: "user",
                content: expect.arrayContaining([
                  expect.objectContaining({
                    type: "text",
                    text: expect.stringContaining("What's this repo about"),
                  }),
                ]),
              }),
              expect.objectContaining({
                role: "assistant",
                content: expect.arrayContaining([
                  expect.objectContaining({
                    type: "function_call",
                    function_call: expect.objectContaining({
                      name: "bash",
                      arguments: { command: "ls -F" },
                    }),
                  }),
                ]),
              }),
              expect.objectContaining({
                role: "user",
                content: expect.arrayContaining([
                  expect.objectContaining({
                    type: "function_response",
                    function_response: expect.objectContaining({ name: "bash" }),
                  }),
                ]),
              }),
            ],
          },
          extra: {
            metadata: {
              usage_metadata: {
                input_tokens: 2013,
                output_tokens: 69,
                total_tokens: 2082,
                input_token_details: { cache_read: 0, cache_creation: 0 },
              },
            },
          },
        }),
        run`read:6`({ run_type: "tool", inputs: { args: { path: "package.json" } } }),
        run`read:7`({ run_type: "tool", inputs: { args: { path: "README.md" } } }),
      ),
      run`Pi turn 2:8`(
        { run_type: "chain", inputs: { turnIndex: 2 } },
        run`google:9`({
          run_type: "llm",
          inputs: {
            messages: expect.arrayContaining([
              expect.objectContaining({
                role: "user",
                content: expect.arrayContaining([
                  expect.objectContaining({
                    type: "function_response",
                    function_response: expect.objectContaining({ name: "read" }),
                  }),
                ]),
              }),
            ]),
          },
          extra: {
            metadata: {
              usage_metadata: {
                input_tokens: 3863,
                output_tokens: 59,
                total_tokens: 3922,
                input_token_details: { cache_read: 0, cache_creation: 0 },
              },
            },
          },
        }),
        run`bash:10`({ run_type: "tool", inputs: { args: { command: "find src -type f" } } }),
      ),
      run`Pi turn 3:11`(
        { run_type: "chain", inputs: { turnIndex: 3 } },
        run`google:12`({
          run_type: "llm",
          inputs: {
            messages: expect.arrayContaining([
              expect.objectContaining({
                role: "assistant",
                content: expect.arrayContaining([
                  expect.objectContaining({
                    type: "function_call",
                    function_call: expect.objectContaining({
                      name: "bash",
                      arguments: { command: "find src -type f" },
                    }),
                  }),
                ]),
              }),
            ]),
          },
          extra: {
            metadata: {
              usage_metadata: {
                input_tokens: 3951,
                output_tokens: 87,
                total_tokens: 4038,
                input_token_details: { cache_read: 0, cache_creation: 0 },
              },
            },
          },
        }),
        run`read:13`({ run_type: "tool", inputs: { args: { path: "src/index.ts" } } }),
        run`read:14`({ run_type: "tool", inputs: { args: { path: "src/config.ts" } } }),
      ),
      run`Pi turn 4:15`(
        { run_type: "chain", inputs: { turnIndex: 4 } },
        run`google:16`({
          run_type: "llm",
          inputs: {
            messages: expect.arrayContaining([
              expect.objectContaining({
                role: "user",
                content: expect.arrayContaining([
                  expect.objectContaining({
                    type: "function_response",
                    function_response: expect.objectContaining({ name: "read" }),
                  }),
                ]),
              }),
            ]),
          },
          extra: {
            metadata: {
              usage_metadata: {
                input_tokens: 9538,
                output_tokens: 36,
                total_tokens: 9574,
                input_token_details: { cache_read: 0, cache_creation: 0 },
              },
            },
          },
        }),
        run`read:17`({ run_type: "tool", inputs: { args: { path: "src/types.ts" } } }),
      ),
      run`Pi turn 5:18`(
        { run_type: "chain", inputs: { turnIndex: 5 } },
        run`google:19`({
          run_type: "llm",
          inputs: {
            messages: expect.arrayContaining([
              expect.objectContaining({
                role: "assistant",
                content: expect.arrayContaining([
                  expect.objectContaining({
                    type: "function_call",
                    function_call: expect.objectContaining({
                      name: "read",
                      arguments: { path: "src/types.ts" },
                    }),
                  }),
                ]),
              }),
            ]),
          },
          extra: {
            metadata: {
              usage_metadata: {
                input_tokens: 9711,
                output_tokens: 54,
                total_tokens: 9765,
                input_token_details: { cache_read: 0, cache_creation: 0 },
              },
            },
          },
        }),
        run`bash:20`({ run_type: "tool", inputs: { args: { command: "find test -type f" } } }),
      ),
      run`Pi turn 6:21`(
        { run_type: "chain", inputs: { turnIndex: 6 } },
        run`google:22`({
          run_type: "llm",
          inputs: {
            messages: expect.arrayContaining([
              expect.objectContaining({
                role: "user",
                content: expect.arrayContaining([
                  expect.objectContaining({
                    type: "function_response",
                    function_response: expect.objectContaining({ name: "bash" }),
                  }),
                ]),
              }),
            ]),
          },
          extra: {
            metadata: {
              usage_metadata: {
                input_tokens: 9866,
                output_tokens: 46,
                total_tokens: 9912,
                input_token_details: { cache_read: 0, cache_creation: 0 },
              },
            },
          },
        }),
        run`read:23`({
          run_type: "tool",
          inputs: { args: { path: "test/normalize.test.ts" } },
        }),
      ),
      run`Pi turn 7:24`(
        { run_type: "chain", inputs: { turnIndex: 7 } },
        run`google:25`({
          run_type: "llm",
          inputs: {
            messages: expect.arrayContaining([
              expect.objectContaining({
                role: "assistant",
                content: expect.arrayContaining([
                  expect.objectContaining({
                    type: "function_call",
                    function_call: expect.objectContaining({
                      name: "read",
                      arguments: { path: "test/normalize.test.ts" },
                    }),
                  }),
                ]),
              }),
            ]),
          },
          outputs: {
            messages: [
              expect.objectContaining({
                role: "assistant",
                stopReason: "error",
                errorMessage: expect.stringContaining("Quota exceeded"),
              }),
            ],
          },
          error: expect.stringContaining("Quota exceeded"),
          extra: {
            metadata: {
              stop_reason: "error",
              usage_metadata: {
                input_tokens: 0,
                output_tokens: 0,
                total_tokens: 0,
                input_token_details: { cache_read: 0, cache_creation: 0 },
              },
            },
          },
        }),
      ),
    );
  });

  expect(tree.nodes).toEqual(expected.nodes);
  expect(tree.edges).toEqual(expected.edges);
  expect(tree.data).toMatchObject(expected.data);
});
