import { expect, it, vi } from "vitest";
import * as fs from "node:fs";
import extension from "../src/index";
import { replayExtension } from "./utils/replay";
import { mockClient } from "./utils/mock_client";
import { asTree, getAssumedTreeFromCalls } from "./utils/tree";

vi.stubEnv("TRACE_TO_LANGSMITH", "true");

// Pi before 0.80.4, which does not emit `agent_settled`.
vi.mock("@earendil-works/pi-coding-agent", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  VERSION: "0.80.3",
}));

it("still ends the trace at agent_end on Pi without agent_settled", async () => {
  const { client, callSpy } = mockClient();

  await replayExtension(
    (pi) => extension(pi, { client }),
    await fs.promises.readFile(
      new URL("./recordings/faux-overflow-compaction.jsonl", import.meta.url),
      "utf-8",
    ),
  );

  await client.awaitPendingTraceBatches();
  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);

  const expected = asTree((run) => {
    run`Pi agent run:0`(
      { inputs: { prompt: "What is Pi?" } },
      run`Pi turn 0:1`({}, run`anthropic:2`({ run_type: "llm" })),
    );
    run`Pi agent run:3`(
      {
        inputs: { prompt: "Summarize this repo" },
        error: "prompt is too long: 213462 tokens > 200000 maximum",
      },
      run`Pi turn 0:4`({}, run`anthropic:5`({ run_type: "llm" })),
    );
  });

  expect(tree.nodes).toEqual(expected.nodes);
  expect(tree.edges).toEqual(expected.edges);
  expect(tree.data).toMatchObject(expected.data);
});
