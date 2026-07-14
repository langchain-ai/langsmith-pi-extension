# @langchain/langsmith-pi-extension

## 0.1.0

### Minor Changes

- [#17](https://github.com/langchain-ai/langsmith-pi-extension/pull/17) [`10d44c2`](https://github.com/langchain-ai/langsmith-pi-extension/commit/10d44c22fbda2a15d90d06d85e8e4bcfdbee1b39) Thanks [@harisaiharish](https://github.com/harisaiharish)! - Adopt the coding-agent-v1 trace metadata contract. Every run now carries the
  shared identity block (`ls_agent_kind`, `ls_integration` = `pi`,
  `ls_agent_runtime` = `Pi`, `thread_id`, `ls_trace_schema_version`), plugin and
  runtime versions, `turn_number`, and repository/git/cwd attribution, emitted via
  a single shared helper and propagated to child runs.
