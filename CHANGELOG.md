# @langchain/langsmith-pi-extension

## 0.2.1

### Patch Changes

- [#42](https://github.com/langchain-ai/langsmith-pi-extension/pull/42) [`943263e`](https://github.com/langchain-ai/langsmith-pi-extension/commit/943263e8b7419fcefcd2e6ac8faaf6f85e230176) Thanks [@cassfij](https://github.com/cassfij)! - On Pi 0.80.4 and later, keep the trace open until `agent_settled`, so agent loops Pi restarts without `before_agent_start` (such as the retry after an overflow compaction) are no longer dropped. Compaction is recorded as a `Context Compaction (<reason>)` child run. Behavior on earlier Pi is unchanged.

## 0.2.0

### Minor Changes

- [#29](https://github.com/langchain-ai/langsmith-pi-extension/pull/29) [`68fcd56`](https://github.com/langchain-ai/langsmith-pi-extension/commit/68fcd5614321dfa3c6bffb23bf03258e3d530ed2) Thanks [@jeffbarg](https://github.com/jeffbarg)! - Support programmatic use by host applications. The default export now accepts a `config` option that bypasses environment and `.pi/langsmith.json` discovery, and a `getParentRunTree` option that nests each Pi agent run under a host-managed LangSmith run instead of starting a new trace. The package also ships type declarations.

## 0.1.0

### Minor Changes

- [#17](https://github.com/langchain-ai/langsmith-pi-extension/pull/17) [`10d44c2`](https://github.com/langchain-ai/langsmith-pi-extension/commit/10d44c22fbda2a15d90d06d85e8e4bcfdbee1b39) Thanks [@harisaiharish](https://github.com/harisaiharish)! - Adopt the coding-agent-v1 trace metadata contract. Every run now carries the
  shared identity block (`ls_agent_kind`, `ls_integration` = `pi`,
  `ls_agent_runtime` = `Pi`, `thread_id`, `ls_trace_schema_version`), plugin and
  runtime versions, `turn_number`, and repository/git/cwd attribution, emitted via
  a single shared helper and propagated to child runs.
