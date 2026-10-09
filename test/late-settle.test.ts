import { expect, it, vi } from "vitest";
import * as fs from "node:fs";
import extension from "../src/index";
import { replayExtension } from "./utils/replay";
import { mockClient } from "./utils/mock_client";
import { asTree, getAssumedTreeFromCalls } from "./utils/tree";

vi.stubEnv("TRACE_TO_LANGSMITH", "true");

// Pi >=0.80.4 <0.87.0 emits `agent_settled` but lets a settled handler start the
// next prompt before the remaining settled handlers run.
vi.mock("@earendil-works/pi-coding-agent", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  VERSION: "0.86.1",
}));

it("ignores a late agent_settled from the previous prompt", async () => {
  const lines = (
    await fs.promises.readFile(
      new URL("./recordings/faux-overflow-compaction.jsonl", import.meta.url),
      "utf-8",
    )
  )
    .trim()
    .split("\n");
  const eventName = (line: string) => JSON.parse(line)[1] as string;

  // Simulate another extension's `agent_settled` handler starting the next
  // prompt: our handler only sees the first prompt's settle once the second
  // prompt has reached `turn_start`.
  const settledIdx = lines.findIndex((line) => eventName(line) === "agent_settled");
  const [settled] = lines.splice(settledIdx, 1);
  const turnStartIdx = lines.findIndex(
    (line, idx) => idx >= settledIdx && eventName(line) === "turn_start",
  );
  lines.splice(turnStartIdx + 1, 0, settled);

  const { client, callSpy } = mockClient();
  await replayExtension((pi) => extension(pi, { client }), lines.join("\n"));

  await client.awaitPendingTraceBatches();
  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);

  const expected = asTree((run) => {
    run`Pi agent run:0`(
      { inputs: { prompt: "What is Pi?" } },
      run`Pi turn 0:1`({}, run`anthropic:2`({ run_type: "llm" })),
    );
    run`Pi agent run:3`(
      { inputs: { prompt: "Summarize this repo" } },
      run`Pi turn 0:4`(
        {},
        run`anthropic:5`({
          run_type: "llm",
          error: "prompt is too long: 213462 tokens > 200000 maximum",
        }),
      ),
      run`Context Compaction (overflow):6`({ run_type: "chain" }),
      run`Pi turn 0:7`({}, run`anthropic:8`({ run_type: "llm" })),
    );
  });

  expect(tree.nodes).toEqual(expected.nodes);
  expect(tree.edges).toEqual(expected.edges);
  expect(tree.data).toMatchObject(expected.data);

  // The first prompt keeps its own result rather than being marked replaced.
  expect(tree.data["Pi agent run:0"]).not.toHaveProperty("error");
  expect(tree.data["Pi agent run:0"].outputs).toHaveProperty("messages");
  // The second prompt is ended by its own settle, not the stale one.
  expect(tree.data["Pi agent run:3"]).not.toHaveProperty("error");
  expect(tree.data["Pi agent run:3"].outputs).toHaveProperty("messages");
  expect(tree.data["Pi agent run:3"].outputs).not.toHaveProperty("incomplete");
});
