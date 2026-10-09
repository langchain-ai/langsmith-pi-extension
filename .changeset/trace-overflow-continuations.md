---
"@langchain/langsmith-pi-extension": patch
---

On Pi 0.80.4 and later, keep the trace open until `agent_settled`, so agent loops Pi restarts without `before_agent_start` (such as the retry after an overflow compaction) are no longer dropped. Compaction is recorded as a `Context Compaction (<reason>)` child run. Behavior on earlier Pi is unchanged.
