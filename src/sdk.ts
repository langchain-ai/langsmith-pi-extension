import { RunTree } from "langsmith";
import langsmith from "@langchain/langsmith-pi-extension";
import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

const resourceLoader = new DefaultResourceLoader({
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  extensionFactories: [
    (pi) =>
      langsmith(pi, {
        // Use this config instead of discovering one from env vars and
        // .pi/langsmith.json files. Defaults still apply.
        config: {
          enabled: true,
          api_key: "...",
          project: "my-app-agents",
        },
        // By default, the extension will use the current traceable run as the parent for agent runs.
        // You can override this behavior by providing a `getCurrentRunTree` function:
        getCurrentRunTree() {
          return new RunTree({ name: "parent run", run_type: "chain" });
        },
      }),
  ],
});

await resourceLoader.reload();

const { session } = await createAgentSession({
  resourceLoader,
  sessionManager: SessionManager.inMemory(),
});

try {
  session.subscribe((event) => {
    if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
      process.stdout.write(event.assistantMessageEvent.delta);
    }
  });

  await session.prompt("List files in the current directory.");
  console.log();
} finally {
  session.dispose();
}
