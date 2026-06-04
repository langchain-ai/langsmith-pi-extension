import { expect, it, vi } from "vitest";
import * as fs from "node:fs";
import extension from "../src/index";
import { replayExtension } from "./utils/replay";
import { mockClient } from "./utils/mock_client";
import { asTree, getAssumedTreeFromCalls } from "./utils/tree";

it("tool-calls", async () => {
  vi.stubEnv("TRACE_TO_LANGSMITH", "true");
  const { client, callSpy } = mockClient();

  await replayExtension(
    (pi) => extension(pi, { client }),
    await fs.promises.readFile(new URL("./recordings/tool-calls.jsonl", import.meta.url), "utf-8"),
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
          extra: {
            metadata: {
              usage_metadata: { input_tokens: 1483, output_tokens: 35, total_tokens: 1518 },
            },
          },
        }),
        run`bash:3`({ run_type: "tool", inputs: { args: { command: "ls" } } }),
      ),
      run`Pi turn 1:4`(
        { run_type: "chain", inputs: { turnIndex: 1 } },
        run`openai:5`({
          run_type: "llm",
          extra: {
            metadata: {
              usage_metadata: { input_tokens: 1559, output_tokens: 75, total_tokens: 1634 },
            },
          },
        }),
        run`read:6`({ run_type: "tool" }),
        run`read:7`({ run_type: "tool" }),
        run`bash:8`({ run_type: "tool" }),
      ),
      run`Pi turn 2:9`(
        { run_type: "chain", inputs: { turnIndex: 2 } },
        run`openai:10`({
          run_type: "llm",
          extra: {
            metadata: {
              usage_metadata: { input_tokens: 888, output_tokens: 121, total_tokens: 2033 },
            },
          },
        }),
        run`read:11`({ run_type: "tool" }),
        run`read:12`({ run_type: "tool" }),
        run`read:13`({ run_type: "tool" }),
        run`read:14`({ run_type: "tool" }),
        run`read:15`({ run_type: "tool" }),
      ),
      run`Pi turn 3:16`(
        { run_type: "chain", inputs: { turnIndex: 3 } },
        run`openai:17`({
          run_type: "llm",
          extra: {
            metadata: {
              usage_metadata: { input_tokens: 14570, output_tokens: 74, total_tokens: 16180 },
            },
          },
        }),
        run`bash:18`({ run_type: "tool" }),
      ),
      run`Pi turn 4:19`(
        { run_type: "chain", inputs: { turnIndex: 4 } },
        run`openai:20`({
          run_type: "llm",
          extra: {
            metadata: {
              usage_metadata: { input_tokens: 418, output_tokens: 1858, total_tokens: 18148 },
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
