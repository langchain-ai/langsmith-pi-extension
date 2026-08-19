---
"@langchain/langsmith-pi-extension": minor
---

Stop re-sending run inputs on the closing update. `safeEnd` now calls
`patchRun({ excludeInputs: true })`, so the full provider payload on LLM runs is
uploaded once at creation instead of twice per run. Traces are unchanged.
