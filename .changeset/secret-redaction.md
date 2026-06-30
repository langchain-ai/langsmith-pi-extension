---
"@langchain/langsmith-pi-extension": minor
---

Redact secrets from traces before upload, on by default. Detected secrets
(provider keys, JWTs, PEM blocks, and structural `NAME=value` / `Authorization` /
URL-credential shapes) are stripped from run inputs/outputs/metadata. Opt out with
`LANGSMITH_PI_REDACT=false`; add custom rules via `LANGSMITH_PI_REDACT_EXTRA`.
