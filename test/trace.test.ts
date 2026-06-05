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
        extra: { metadata: { ls_integration: "langsmith-pi-extension" } },
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
        extra: { metadata: { ls_integration: "langsmith-pi-extension" } },
      },
      run`Pi turn 0:1`(
        { run_type: "chain", inputs: { turnIndex: 0 } },
        run`anthropic:2`({
          run_type: "llm",
          inputs: {
            model: "claude-opus-4-8",
            stream: true,
            messages: [
              { role: "user", content: [{ type: "text", text: "Inspect this repo for me" }] },
            ],
            system: [{ type: "text", text: expect.stringContaining("coding assistant") }],
          },
          extra: {
            metadata: {
              usage_metadata: {
                input_tokens: 2838,
                output_tokens: 108,
                total_tokens: 2946,
                input_token_details: { cache_read: 0, cache_creation: 2836 },
              },
            },
          },
        }),
        run`bash:3`({
          run_type: "tool",
          inputs: { args: { command: expect.stringContaining("ls -la") } },
        }),
      ),
      run`Pi turn 1:4`(
        { run_type: "chain", inputs: { turnIndex: 1 } },
        run`anthropic:5`({
          run_type: "llm",
          inputs: {
            messages: expect.arrayContaining([
              expect.objectContaining({
                role: "tool",
                tool_use_id: expect.stringContaining("tool"),
              }),
            ]),
          },
          extra: {
            metadata: {
              usage_metadata: {
                input_tokens: 4056,
                output_tokens: 85,
                total_tokens: 4056 + 85,
                input_token_details: { cache_read: 2836, cache_creation: 1218 },
              },
            },
          },
        }),
        run`bash:6`({
          run_type: "tool",
          inputs: { args: { command: expect.stringContaining("find src") } },
        }),
      ),
      run`Pi turn 2:7`(
        { run_type: "chain", inputs: { turnIndex: 2 } },
        run`anthropic:8`({
          run_type: "llm",
          extra: {
            metadata: {
              usage_metadata: {
                input_tokens: 4414,
                output_tokens: 75,
                total_tokens: 4414 + 75,
                input_token_details: { cache_read: 4054, cache_creation: 358 },
              },
            },
          },
        }),
        run`bash:9`({
          run_type: "tool",
          inputs: { args: { command: expect.stringContaining("cd") } },
        }),
      ),
      run`Pi turn 3:10`(
        { run_type: "chain", inputs: { turnIndex: 3 } },
        run`anthropic:11`({
          run_type: "llm",
          extra: {
            metadata: {
              usage_metadata: {
                input_tokens: 10831,
                output_tokens: 103,
                total_tokens: 10831 + 103,
                input_token_details: { cache_read: 4412, cache_creation: 6417 },
              },
            },
          },
        }),
        run`bash:12`({
          run_type: "tool",
          inputs: { args: { command: expect.stringContaining("cd") } },
        }),
      ),
      run`Pi turn 4:13`(
        { run_type: "chain", inputs: { turnIndex: 4 } },
        run`anthropic:14`({
          run_type: "llm",
          extra: {
            metadata: {
              usage_metadata: {
                input_tokens: 13750,
                output_tokens: 116,
                total_tokens: 13750 + 116,
                input_token_details: { cache_read: 10829, cache_creation: 2919 },
              },
            },
          },
        }),
        run`bash:15`({
          run_type: "tool",
          inputs: { args: { command: expect.stringContaining("cd") } },
        }),
      ),
      run`Pi turn 5:16`(
        { run_type: "chain", inputs: { turnIndex: 5 } },
        run`anthropic:17`({
          run_type: "llm",
          extra: {
            metadata: {
              usage_metadata: {
                input_tokens: 15178,
                output_tokens: 123,
                total_tokens: 15178 + 123,
                input_token_details: { cache_read: 13748, cache_creation: 1428 },
              },
            },
          },
        }),
        run`bash:18`({
          run_type: "tool",
          inputs: { args: { command: expect.stringContaining("cd") } },
        }),
      ),
      run`Pi turn 6:19`(
        { run_type: "chain", inputs: { turnIndex: 6 } },
        run`anthropic:20`({
          run_type: "llm",
          extra: {
            metadata: {
              usage_metadata: {
                input_tokens: 16633,
                output_tokens: 170,
                total_tokens: 16633 + 170,
                input_token_details: { cache_read: 15176, cache_creation: 1455 },
              },
            },
          },
        }),
        run`bash:21`({
          run_type: "tool",
          inputs: { args: { command: expect.stringContaining("cd") } },
        }),
      ),
      run`Pi turn 7:22`(
        { run_type: "chain", inputs: { turnIndex: 7 } },
        run`anthropic:23`({
          run_type: "llm",
          extra: {
            metadata: {
              usage_metadata: {
                input_tokens: 16941,
                output_tokens: 1447,
                total_tokens: 16941 + 1447,
                input_token_details: { cache_read: 16631, cache_creation: 308 },
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
