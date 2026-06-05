import { it } from "vitest";
import * as fs from "node:fs";
import { Client } from "langsmith";
import extension from "../src/index";
import { replayExtension } from "./utils/replay";

it.skip("replay", { timeout: 60_000 }, async () => {
  const client = new Client();

  await replayExtension(
    (pi) => extension(pi, { client }),
    await fs.promises.readFile("langsmith.jsonl", "utf-8"),
  );

  await client.awaitPendingTraceBatches();
});
