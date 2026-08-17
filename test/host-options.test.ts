import { expect, it } from "vitest";
import * as fs from "node:fs";
import { RunTree } from "langsmith";
import { traceable, withRunTree } from "langsmith/traceable";
import extension from "../src/index";
import { replayExtension } from "./utils/replay";
import { mockClient } from "./utils/mock_client";

// Deliberately no TRACE_TO_LANGSMITH stub: these tests cover hosts that
// configure the extension programmatically instead of via the environment.

const recording = () =>
  fs.promises.readFile(
    new URL("./recordings/anthropic-tool-calls.jsonl", import.meta.url),
    "utf-8",
  );

const getPostedRuns = async (
  client: ReturnType<typeof mockClient>["client"],
  callSpy: ReturnType<typeof mockClient>["callSpy"],
) => {
  await client.awaitPendingTraceBatches();
  return (callSpy.mock.calls as unknown[][])
    .map((call) => {
      const [url, fetchArgs] = call.slice(-2) as [string, { method: string; body: unknown }];
      if (fetchArgs.method !== "POST" || !new URL(url).pathname.endsWith("/runs")) {
        return undefined;
      }
      const body =
        typeof fetchArgs.body === "string"
          ? fetchArgs.body
          : new TextDecoder().decode(fetchArgs.body as Uint8Array);
      return JSON.parse(body) as {
        id: string;
        name: string;
        trace_id: string;
        parent_run_id?: string;
        session_name?: string;
      };
    })
    .filter((run) => run !== undefined);
};

it("enables tracing from an options-provided config", async () => {
  const { client, callSpy } = mockClient();

  await replayExtension(
    (pi) => extension(pi, { client, config: { enabled: true } }),
    await recording(),
  );

  const runs = await getPostedRuns(client, callSpy);
  const root = runs.find((run) => run.name === "Pi agent run");
  expect(root).toBeDefined();
  expect(root!.parent_run_id).toBeUndefined();
  // Config defaults still apply to an options-provided config.
  expect(root!.session_name).toBe("pi-coding-agent");
});

it("nests agent runs under a host-provided parent run tree", async () => {
  const { client, callSpy } = mockClient();
  const parent = new RunTree({ name: "host run", run_type: "chain", client });

  await withRunTree(parent, async () => {
    await replayExtension(
      (pi) => extension(pi, { client, config: { enabled: true } }),
      await recording(),
    );
  });

  const runs = await getPostedRuns(client, callSpy);
  const root = runs.find((run) => run.name === "Pi agent run");
  expect(root).toBeDefined();
  expect(root!.parent_run_id).toBe(parent.id);
  expect(root!.trace_id).toBe(parent.trace_id);
});

it("nests agent runs under the current traceable run", async () => {
  const { client, callSpy } = mockClient();

  const host = traceable(
    async () => {
      await replayExtension(
        (pi) => extension(pi, { client, config: { enabled: true } }),
        await recording(),
      );
    },
    { name: "host run", run_type: "chain", client, tracingEnabled: true },
  );
  await host();

  const runs = await getPostedRuns(client, callSpy);
  const parent = runs.find((run) => run.name === "host run");
  const root = runs.find((run) => run.name === "Pi agent run");
  expect(parent).toBeDefined();
  expect(root).toBeDefined();
  expect(root!.parent_run_id).toBe(parent!.id);
  expect(root!.trace_id).toBe(parent!.trace_id);
});
