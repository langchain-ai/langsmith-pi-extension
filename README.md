# @langchain/langsmith-pi-extension

Trace [Pi Coding Agent](https://pi.dev) invocations to [LangSmith](https://smith.langchain.com), so you can observe turns, debug tool calls, track token usage and inspect individual LLM invocations within LangSmith.

## Installation

Install extension via Pi:

```sh
pi install npm:@langchain/langsmith-pi-extension
```

## Quick Start

Tracing is disabled by default. Add the following environment variables to enable tracing and connect to your LangSmith account.

```sh
export TRACE_TO_LANGSMITH=true
export LANGSMITH_PI_API_KEY="<your-langsmith-api-key>"
```

Run Pi as usual. When a session starts, the extension reports whether LangSmith tracing is enabled. You can also check the current session state from Pi with:

```text
/langsmith-tracing
```

By default, traces are written to the `pi-coding-agent` LangSmith project.

## Configuration

Configuration can come from environment variables or JSON config files. Values are merged in this order, with later sources taking precedence:

1. Defaults
2. `~/.pi/langsmith.json`
3. `<current-working-directory>/.pi/langsmith.json`
4. Environment variables

### Environment Variables

| Variable                      | Description                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `TRACE_TO_LANGSMITH`          | Enables tracing when set to `true`, `1`, `yes`, or `on`. Disables tracing when set to `false`, `0`, `no`, or `off`. |
| `LANGSMITH_PI_API_KEY`        | LangSmith API key. Falls back to `LANGSMITH_API_KEY`.                                                               |
| `LANGSMITH_PI_ENDPOINT`       | LangSmith API URL for self-hosted or custom deployments. Falls back to `LANGSMITH_ENDPOINT`.                        |
| `LANGSMITH_PI_PROJECT`        | LangSmith project name. Falls back to `LANGSMITH_PROJECT`. Defaults to `pi-coding-agent`.                           |
| `LANGSMITH_PI_METADATA`       | JSON object added to the root run metadata. Falls back to `LANGSMITH_METADATA`.                                     |
| `LANGSMITH_PI_RUNS_ENDPOINTS` | JSON array of replica run destinations. Falls back to `LANGSMITH_RUNS_ENDPOINTS`.                                   |

Example:

```sh
export TRACE_TO_LANGSMITH=true
export LANGSMITH_PI_API_KEY="<your-langsmith-api-key>"
export LANGSMITH_PI_PROJECT="pi-coding-agent-dev"
export LANGSMITH_PI_METADATA='{"team":"infra","environment":"local"}'
```

### Config File

Create either `~/.pi/langsmith.json` for global settings or `.pi/langsmith.json` in a project for local overrides:

```json
{
  "enabled": true,
  "api_key": "<your-langsmith-api-key>",
  "api_url": "https://api.smith.langchain.com",
  "project": "pi-coding-agent",
  "metadata": { "environment": "local" },
  "replicas": [
    {
      "api_url": "https://api.smith.langchain.com",
      "api_key": "lsv2_pt_...",
      "project": "pi-coding-agent-replica",
      "updates": { "metadata": { "replica": true } }
    }
  ]
}
```

| Field      | Required | Default               | Description                                                                      |
| ---------- | -------- | --------------------- | -------------------------------------------------------------------------------- |
| `enabled`  | Yes      | `false`               | Set to `true` to enable tracing from the config file.                            |
| `api_key`  | No\*     | -                     | LangSmith API key. Required unless provided by environment variable or replicas. |
| `api_url`  | No       | LangSmith SDK default | LangSmith API URL, usually `https://api.smith.langchain.com`.                    |
| `project`  | No       | `pi-coding-agent`     | LangSmith project name.                                                          |
| `metadata` | No       | -                     | Object merged into root trace metadata.                                          |
| `replicas` | No       | -                     | Array of additional LangSmith destinations to replicate traces to.               |

### Replicas

Use `replicas` to send runs to additional LangSmith destinations:

```json
{
  "enabled": true,
  "api_key": "<primary-api-key>",
  "project": "pi-coding-agent",
  "replicas": [
    {
      "api_key": "<replica-api-key>",
      "api_url": "https://replica-langsmith.example.com",
      "project": "pi-coding-agent-replica",
      "updates": {
        "tags": ["replica"]
      }
    }
  ]
}
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, testing, and pull request guidance.
