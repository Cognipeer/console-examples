# 09 - Tracing and observability

Send traces of an agent to Console (**Agent Observability**, the tracing module) in two ways:

| Script | What it shows |
|---|---|
| `npm run otlp` | Plain OpenTelemetry. Spans with OTel GenAI attributes are exported as OTLP/HTTP **JSON** to `POST /api/client/v1/traces`. No Cognipeer SDK needed. |
| `npm run langchain` | A LangChain tool-calling agent traced with `@cognipeer/observability` (`CognipeerCallbackHandler` via `cognipeerConfig`). The model is called through the Console gateway. |

Console features: **Agent Observability -> Sessions**, **Agent Observability -> Threads**, token and cost accounting, tool definitions.
Reference: the Observability guides (OpenTelemetry, LangChain, Data Model, Troubleshooting).

## Prerequisites

- Node.js 22+ (the `openai` and `@langchain/openai` packages require it)
- A Console project and an API token with the **tracing** service enabled

## Console setup

1. Open **Settings -> API Tokens -> Create Token**. Enable the **tracing** service. Copy the token (shown once).
2. For `npm run langchain` only: make sure a chat model exists in your project (**Model Hub**) and note its key. The token also needs access to the model/gateway service.

## Configure

```bash
cp .env.example .env     # then edit
npm install
```

| Variable | Meaning |
|---|---|
| `COGNIPEER_API_KEY` | API token (`cpeer_...`) |
| `COGNIPEER_BASE_URL` | Console base URL, e.g. `https://console.cognipeer.com` or your self-hosted URL |
| `CONSOLE_MODEL_KEY` | Model key used by the LangChain example |

## Run

```bash
npm run otlp
npm run langchain
npm run typecheck
```

## Expected result

Open **Agent Observability -> Sessions**:

- `otlp`: a session for `otlp-demo-agent` with two `ai_call` events (prompt, completion, tool definitions, 120/18 and 160/14 tokens) and one `tool_call` event. The thread id is printed in the terminal; find it under **Agent Observability -> Threads**.
- `langchain`: a session named `support-bot` in thread `conv-42` with one `ai_call` per model call (with a Tool Definitions badge list) and one `tool_call` for `lookup_order`.

## How it works

- **OTLP**: the endpoint reads JSON only. `@opentelemetry/exporter-trace-otlp-http` sends JSON by default. If you use another exporter that defaults to protobuf, set `OTEL_EXPORTER_OTLP_TRACES_PROTOCOL=http/json` or put an OpenTelemetry Collector in front. Auth is the `authorization: Bearer cpeer_...` header. Conversation grouping needs an explicit `gen_ai.conversation.id` (OpenInference uses `session.id`).
- **LangChain**: `cognipeerConfig('conv-42')` attaches the handler and writes the thread id to both `configurable` and `metadata`, so it works on every `@langchain/core` version. Wrapping the loop in one `RunnableLambda` puts all steps into one session. `streamUsage: true` makes streaming calls report tokens, and `awaitAllCallbacks()` + `flush()` guarantee delivery before exit.

## Errors

| Status | Cause |
|---|---|
| 400 | Invalid OTLP payload (`resourceSpans` missing) or no spans |
| 401 / 403 | Wrong token or the token lacks the **tracing** service |
| 413 | Payload larger than the allowed body size |
| 429 | Quota exceeded |

Debug the Cognipeer SDK with `COGNIPEER_DEBUG=1 npm run langchain`; it logs every HTTP POST and its status.

> Not run against a live Console. The scripts are type-checked, and `npm run otlp` was also run against a stand-in HTTP server that accepts the OTLP request.
