---
"@langchain/langsmith-pi-extension": minor
---

Support programmatic use by host applications. The default export now accepts a `config` option that bypasses environment and `.pi/langsmith.json` discovery, and a `getParentRunTree` option that nests each Pi agent run under a host-managed LangSmith run instead of starting a new trace. The package also ships type declarations.
