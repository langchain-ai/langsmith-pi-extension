# Contributing

Thanks for helping improve `@langchain/langsmith-pi-extension`. This project is a TypeScript package for tracing Pi Coding Agent sessions to LangSmith.

## Development Setup

Install dependencies with the pinned package manager:

```sh
pnpm install
```

Build the package:

```sh
pnpm run build
```

Run the test suite:

```sh
pnpm test
```

Run formatting and type checks:

```sh
pnpm run lint
```

Format files:

```sh
pnpm run format
```

## Project Layout

- `src/` contains the extension implementation.
- `test/` contains Vitest tests, fixtures, and replay utilities.
- `dist/` is generated build output.
- `README.md` documents user-facing installation and configuration.

## Making Changes

Keep changes focused and consistent with the existing code style. Prefer small, direct changes over broad refactors unless the refactor is necessary for the feature or fix.

When changing tracing behavior, configuration parsing, or run serialization, add or update tests that cover the observable behavior. Replay-based tests should use fixtures under `test/recordings/` and utilities under `test/utils/`.

## Record and Replay Tests

Use record and replay when iterating on tracing behavior that depends on real Pi event sequences. The recorder captures a single real agent session once, then replay lets you run that same event stream repeatedly without spending more LLM tokens.

To record a session, temporarily run the recorder extension in `test/utils/record.ts` instead of the LangSmith extension.

```shell
pi -e test/utils/record.ts
```

Before committing a recording, inspect it for secrets, local paths, prompts, user identifiers, and API keys. Keep the shortest recording that exercises the behavior under test.

To replay a recording in a test, call `replayExtension` with the real extension and a mocked LangSmith client:

```ts
import { expect, it } from "vitest";
import * as fs from "node:fs";
import extension from "../src/index";
import { replayExtension } from "./utils/replay";
import { mockClient } from "./utils/mock_client";

it("my scenario", async () => {
  const { client, callSpy } = mockClient();

  await replayExtension(
    (pi) => extension(pi, { client }),
    await fs.promises.readFile(new URL("./recordings/my-scenario.jsonl", import.meta.url), "utf-8"),
  );

  await client.awaitPendingTraceBatches();

  expect(callSpy).toHaveBeenCalled();
});
```

For durable integration tests, assert on the run tree shape rather than only checking that calls happened. See `test/trace.test.ts` for examples using `getAssumedTreeFromCalls` and `asTree`.

`test/replay.test.ts` is intentionally skipped and useful for manual debugging against a real LangSmith client. Enable it locally only when you want to send a recorded event stream to LangSmith and inspect the trace output.

Before opening a pull request, run:

```sh
pnpm run lint
pnpm test
pnpm run build
```

## Changesets

User-facing package changes should include a changeset:

```sh
pnpm run changeset
```

Choose the version bump that matches the impact of the change:

- `patch` for bug fixes and internal improvements.
- `minor` for backward-compatible features.
- `major` for breaking changes.

Documentation-only changes generally do not need a changeset.

## Secrets and Local Configuration

Do not commit LangSmith API keys, `.env` files, or local Pi configuration files. Use environment variables or local config files only for manual testing:

```sh
export TRACE_TO_LANGSMITH=true
export LANGSMITH_PI_API_KEY="<your-langsmith-api-key>"
```

If you need to add a fixture that resembles a real trace, scrub tokens, API keys, user identifiers, and sensitive metadata before committing it.

## Pull Request Checklist

- Tests cover the changed behavior, or the PR explains why tests are not needed.
- `pnpm run lint`, `pnpm test`, and `pnpm run build` pass locally.
- User-facing changes are reflected in `README.md` when needed.
- A changeset is included for package behavior changes.
- No secrets or local-only configuration files are committed.
