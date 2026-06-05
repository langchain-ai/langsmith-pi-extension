import { vi } from "vitest";
import { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

export async function replayExtension(
  init: (api: ExtensionAPI) => Promise<void>,
  contents: string,
  options?: { wait?: boolean },
) {
  const events = contents
    .trim()
    .split("\n")
    .map(
      (line) =>
        JSON.parse(line) as [
          currTime: number,
          eventName: string,
          arg: unknown,
          ctx: Record<string, unknown>,
        ],
    );

  const handlers: Record<
    string,
    Array<(arg: unknown, context: ExtensionContext) => Promise<void>>
  > = {};

  const pi = {
    on: (
      eventName: string,
      handler: (arg: unknown, context: ExtensionContext) => Promise<void>,
    ) => {
      handlers[eventName] ??= [];
      handlers[eventName].push(handler);
    },
    registerCommand: (...args: unknown[]) => vi.fn(),
  } as unknown as ExtensionAPI;

  await init(pi);

  // Invoke events from replay
  let lastTime: number | undefined = undefined;
  for (const [currTime, eventName, arg, ctx] of events) {
    let wait = lastTime !== undefined ? Math.max(0, currTime - lastTime) : 0;
    if (eventName === "session_shutdown") wait = 0; // Don't wait after shutdown event

    if (wait > 0 && options?.wait) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }

    for (const handler of handlers[eventName] ?? []) {
      const context = {
        ui: { setStatus: vi.fn() },
        ...ctx,
        getContextUsage: () => ctx?.getContextUsage,
      } as unknown as ExtensionContext;

      await handler(arg, context);
    }

    lastTime = currTime;
  }
}
