# 01 - OpenAI-compatible gateway

Use the **official OpenAI SDKs** (TypeScript and Python) against Cognipeer Console. Console exposes an
OpenAI-compatible surface under `<console>/api/client/v1`, so the only change in your code is `baseURL` and the API key.

**Console features shown:** Model Hub (model keys), API tokens, `POST /chat/completions` (JSON and SSE streaming),
tool calling, `POST /embeddings`, and how guardrail blocks / PII redaction surface to the caller.

## Prerequisites

- A running Console (SaaS or self-hosted) and a project with at least one chat (LLM) model and, optionally, an embedding model.
- Node.js 22+ (TypeScript examples; the `openai` package requires it) and/or Python 3.10+ (Python examples; the pinned `openai` package requires it).

## Console setup (UI)

1. **Model Hub**: open Model Hub in your project and make sure a chat model is deployed. Note its **key** (the `Key` column).
   Repeat for an embedding model if you want to run `embeddings.ts`.
2. **Settings -> API Tokens**: create an API token and copy the secret (it is shown once). It must be allowed to use the Models service.
3. Optional: under **Operate -> Guardrail** create a guardrail (e.g. PII with action `block` or `redact`) and attach it to the
   model on the model's **Configure** tab (**Guardrails** card), to see the behavior described below.

## Model keys vs provider model ids

- The `model` field you send is the **Console model key** (what you named the deployment in the Model Hub), e.g. `my-chat-model`.
- The **provider model id** (e.g. `gpt-4o-mini`) is configured *inside* that Console model and never sent by the client.
  Console resolves the key to a provider + provider model id, applies guardrails, quota, budgets and usage logging, then calls the provider.
- This indirection lets you swap the upstream model, add a Dynamic LLM router (see example 02) or attach guardrails without touching client code.

## Configure

```bash
cp .env.example .env     # fill in the values
npm install
```

| Variable | Meaning |
| --- | --- |
| `CONSOLE_BASE_URL` | Console origin, no `/api/client/v1` suffix |
| `CONSOLE_API_TOKEN` | API token (used as the OpenAI `apiKey`) |
| `CONSOLE_CHAT_MODEL` | Chat model **key** |
| `CONSOLE_EMBEDDING_MODEL` | Embedding model **key** (embeddings only) |

## Run - TypeScript

`tsx` does not load `.env` by itself; use Node's flag:

```bash
node --env-file=.env --import tsx src/chat.ts        # non-streaming
node --env-file=.env --import tsx src/stream.ts      # SSE streaming
node --env-file=.env --import tsx src/tools.ts       # tool-calling round trip
node --env-file=.env --import tsx src/embeddings.ts  # embeddings
npm run typecheck
```

Expected output (`chat.ts`): the answer text (`Paris...`), a `usage` object with prompt/completion/total tokens, and a `request_id`.
`stream.ts` prints the story token by token. `tools.ts` prints the final answer built from your local `get_weather` result.
`embeddings.ts` prints one line per input with the vector size.

## Run - Python

```bash
cd python
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
set -a; source ../.env; set +a
python chat.py
python stream.py
```

## Guardrails and PII redaction as seen by the caller

Documented in the Console OpenAPI spec and guardrail guide:

- **`block` action**: the request fails with **HTTP 400** and body
  `{"error": {"type": "guardrail_block", "guardrail_key": "...", "action": "...", "findings": [...], "message": "..."}}`.
  The OpenAI SDKs raise `BadRequestError` (an `APIError`); `describeError()` (TS) and `describe_error()` (Python) print the guardrail key and findings.
- **`redact` action** (PII and word filter): the call **succeeds** (HTTP 200). Console masks the detected values
  (for example `[REDACTED:email]`) in the input before it reaches the provider, and in the output before it reaches you.
  The caller sees no error, so check the text rather than the status code.
- **Streaming**: a block detected before streaming starts is a normal HTTP 400. A block discovered mid-stream cannot change the already-sent
  headers, so Console reports it in-band (per the server source; not in the OpenAPI spec), in this order:
  a final chunk with `finish_reason: "content_filter"`; if text was already delivered, a
  `{ "guardrail": { "blocked": true, "discardPrior": true } }` frame; an error frame
  `{ "error": { "type": "guardrail_block", "code": "...", "message": "...", "guardrail_key": "..." }, "request_id": "..." }`;
  then `data: [DONE]`.
  The OpenAI SDKs raise the error frame as an `APIError` that has no HTTP status (`APIError` rather than `APIStatusError` in Python), which
  `describeError()` / `describe_error()` handle. They hand the `guardrail` frame to your loop as a chunk without `choices`, which is why
  `stream.ts` and `stream.py` guard that access. Text printed before the error was already delivered; when the `guardrail` frame says
  `discardPrior`, drop it in a real UI.
- Other documented errors: 401 (bad token), 429 (rate limit / quota), 500.

## Files

- `src/client.ts` - shared OpenAI client + error helper
- `src/chat.ts`, `src/stream.ts`, `src/tools.ts`, `src/embeddings.ts`
- `python/client.py`, `chat.py`, `stream.py`, `requirements.txt`

Not verified against a live Console: this example was type-checked, and run only against a stand-in HTTP server that returns the documented response shapes.
