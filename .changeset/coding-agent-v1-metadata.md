---
"@langchain/langsmith-pi-extension": minor
---

Adopt the coding-agent-v1 trace metadata contract. Every run now carries the
shared identity block (`ls_agent_kind`, `ls_integration` = `pi`,
`ls_agent_runtime` = `Pi`, `thread_id`, `ls_trace_schema_version`), plugin and
runtime versions, `turn_number`, and repository/git/cwd attribution, emitted via
a single shared helper and propagated to child runs.
