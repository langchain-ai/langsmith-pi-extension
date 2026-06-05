import { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import * as fs from "node:fs/promises";

export default async function (pi: ExtensionAPI) {
  function createRecord(eventName: string) {
    return async function record(arg: unknown, ctx: ExtensionContext) {
      await fs.appendFile(
        "langsmith.jsonl",
        `${JSON.stringify([
          Date.now(),
          eventName,
          arg,
          {
            cwd: ctx.cwd,
            model: ctx.model,
            getContextUsage: ctx.getContextUsage?.(),
          },
        ])}\n`,
      );
    };
  }

  pi.on("resources_discover", createRecord("resources_discover"));
  pi.on("session_start", createRecord("session_start"));
  pi.on("session_before_switch", createRecord("session_before_switch"));
  pi.on("session_before_fork", createRecord("session_before_fork"));
  pi.on("session_before_compact", createRecord("session_before_compact"));
  pi.on("session_compact", createRecord("session_compact"));
  pi.on("session_shutdown", createRecord("session_shutdown"));
  pi.on("session_before_tree", createRecord("session_before_tree"));
  pi.on("session_tree", createRecord("session_tree"));
  pi.on("context", createRecord("context"));
  pi.on("before_provider_request", createRecord("before_provider_request"));
  pi.on("after_provider_response", createRecord("after_provider_response"));
  pi.on("before_agent_start", createRecord("before_agent_start"));
  pi.on("agent_start", createRecord("agent_start"));
  pi.on("agent_end", createRecord("agent_end"));
  pi.on("turn_start", createRecord("turn_start"));
  pi.on("turn_end", createRecord("turn_end"));
  pi.on("message_start", createRecord("message_start"));
  // No need to record message_update, only useful for streaming
  // pi.on("message_update", createRecord("message_update"));
  pi.on("message_end", createRecord("message_end"));
  pi.on("tool_execution_start", createRecord("tool_execution_start"));
  pi.on("tool_execution_update", createRecord("tool_execution_update"));
  pi.on("tool_execution_end", createRecord("tool_execution_end"));
  pi.on("model_select", createRecord("model_select"));
  pi.on("thinking_level_select", createRecord("thinking_level_select"));
  pi.on("tool_call", createRecord("tool_call"));
  pi.on("tool_result", createRecord("tool_result"));
  pi.on("user_bash", createRecord("user_bash"));
  pi.on("input", createRecord("input"));
}
