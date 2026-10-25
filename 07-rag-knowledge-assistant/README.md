# 07 - RAG knowledge assistant

End to end retrieval-augmented generation on Console: a vector index, a **Knowledge Engine** module, local markdown ingestion, a `topK` / `minScore` query, and an agent that answers from that knowledge.

| Step | Command | What happens |
|---|---|---|
| 1 | `npm run setup` | Creates a vector index, the Knowledge Engine module and a published agent bound to it |
| 2 | `npm run ingest` | Ingests `docs/*.md` (chunked and embedded server-side) and waits until indexed |
| 3 | `npm run query -- "..."` | Raw retrieval with `topK` and `minScore` |
| 4 | `npm run ask -- "..."` | Asks the agent; it searches the module itself and cites file names |

Uses `@cognipeer/console-sdk` 3.1.0 (`vectors.indexes`, `rag`, `agents`). Where the SDK or the OpenAPI spec lags behind the server, the script says so in a comment and uses a cast or `fetch` (see "SDK gaps").

## Prerequisites

- Node.js 20+ (the scripts read `.env` through the `dotenv` package)
- A Console project and an API token with access to Vector, Knowledge Engine and Agents

## Console setup (UI)

1. **Settings -> API Tokens -> Create Token**; copy the token.
2. **Model Hub**: make sure you have one **embedding** model and one **chat** model. Note both model keys and the embedding dimension.
3. **Data -> Knowledge Index**: make sure a vector provider is registered (any driver; pick one you have credentials for; the page enables **Create index** once one exists). Note its key. This example only creates the *index*, because provider credentials are driver specific. (`GET /api/client/v1/vector/providers/drivers` lists the drivers.)

## Configure and run

```bash
cp .env.example .env     # fill in
npm install
npm run setup
npm run ingest
npm run query -- "How many vacation days do I get?"
npm run ask -- "Can I carry over unused vacation days?"
npm run typecheck
```

| Variable | Meaning |
|---|---|
| `CONSOLE_BASE_URL`, `CONSOLE_API_KEY` | Console URL and API token |
| `VECTOR_PROVIDER_KEY` | Existing vector provider from step 3 |
| `EMBEDDING_MODEL_KEY`, `CHAT_MODEL_KEY` | Model keys from step 2 |
| `EMBEDDING_DIMENSION` | Must match the embedding model (default 1536) |
| `RAG_MODULE_KEY`, `AGENT_NAME` | Optional names |

`setup` writes `.state.json` (git-ignored) with the created keys for the other scripts.

## Expected output

```
Created vector index "handbook-demo-index" (dimension 1536)
Created RAG module "handbook-demo"
Created and published agent "handbook-assistant-k3x9qa"
...
vacation-policy.md: indexed, 2 chunks
...
[0.842] vacation-policy.md #0
Full-time employees receive 25 days of paid vacation per calendar year. ...
...
Q: Can I carry over unused vacation days?
A: Yes. Up to 5 unused days carry over and expire on March 31 (vacation-policy.md).
```

Exact scores, chunk counts and wording depend on your models. The agent key gets a random six-character suffix, so yours differs. In the UI the same data appears under **Data -> Knowledge Engine** (module, documents, chunks) and the agent under **Build -> Agents**.

## Endpoints used

| Purpose | Call |
|---|---|
| Create index | `POST /api/client/v1/vector/providers/{providerKey}/indexes` |
| Create module | `POST /api/client/v1/rag/modules` |
| Ingest text | `POST /api/client/v1/rag/modules/{key}/ingest` (`fileName`, `content`, `metadata`) |
| List documents | `GET /api/client/v1/rag/modules/{key}/documents` |
| Query | `POST /api/client/v1/rag/modules/{key}/query` (`query`, `topK`, `minScore`, `filter`) |
| Agent create / publish / chat | `POST /agents`, `POST /agents/{key}/publish`, `POST /responses` with the agent key as `model` (what `client.agents.chat` sends in SDK 3.1.0; `POST /agents/responses` is the agent-only alias) |

## SDK gaps (SDK 3.1.0 vs. server source)

- `defaultTopK` / `defaultMinScore` on module creation are in the OpenAPI `RagCreateInput` schema but not in the SDK 3.1.0 request type, hence the cast in `setup.ts`.
- `minScore` on the query body is accepted by the server but is in neither the OpenAPI request schema nor SDK 3.1.0's `RagQueryRequest`, hence `fetch` in `query.ts`.
- Agent `config.systemPrompt` is in the OpenAPI spec, and `config.knowledgeEngineKey` (the single-module form of a knowledge binding) is accepted by the server; the SDK 3.1.0 `AgentConfig` type declares neither, hence the cast. The Console dashboard now saves a `knowledgeBindings` list instead, and the server still reads the single key. If your Console version ignores it, attach the module in the agent's **Knowledge Engine** setting in the UI instead.
- `agents.chat()` is deprecated in SDK 3.1.0 in favour of `agents.responses.create()`. It runs the *published* agent version, which is why `setup.ts` publishes.

## Errors

| Status | Meaning |
|---|---|
| 400 | Invalid body or metadata filter |
| 401 | Invalid token |
| 404 | Unknown module, provider or agent key |
| 429 | Rate limit or quota |
| 500 | A module key that already exists is reported this way today, with the message `Knowledge Engine module with key "..." already exists`. When re-running `setup`, change `RAG_MODULE_KEY` or delete the module. Each run also creates one more agent. |

Not run against a live Console. The scripts are type-checked, and all four commands were run against a stand-in HTTP server that returns the response shapes documented in the OpenAPI spec.
