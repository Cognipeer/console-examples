# 03 - Agent with additional models

An agent has one **main model** plus up to ten **additional models**. The caller chooses, per request, which one answers. Anyone who may run the agent may use any model on its list; there is no separate permission.

## What it shows

| Script | Console feature |
| --- | --- |
| `src/list-models.ts` | `GET /agents/{agentKey}` returns `agent.models` (main model first, `default: true`). The field is absent when the agent offers fewer than two models. |
| `src/responses.ts` | `POST /agents/responses` with `agent_model` in the body, or the `X-Cognipeer-Agent-Model` header (the body wins). The answering model is reported in `cognipeer.agent_model`. |
| `src/chat-completions.ts` | OpenAI-compatible `POST /chat/completions` with `model: "agent:<key>"`, `agent_model` as an extra body field, or the header. Uses the official `openai` SDK. |
| `src/sticky.ts` | A session remembers the last chosen model: requested model, then the session's last model, then the main model. |
| all | Handling `400 model_not_allowed` when the requested model is not the main model and not on the list. |

## Prerequisites

- Node.js 22+ (the `openai` package requires it)
- A Console project with at least two models (Model Hub), for example two chat models from a provider.
- An API token for that project.

## Console setup (UI)

1. Open **Settings > API Tokens** and create a token. Copy it (`cpeer_...`).
2. Open **Build -> Agents**, create or open an agent, and set its **Model** (this is the main model).
3. In the agent editor add **Additional models**: pick other models of the same project, optionally give each a label and a short "when to choose it" description. Save.
4. **Publish** the agent. The client API runs the published version on `/agents/responses`.
5. Note the agent **key**.

> Menu names can differ slightly between Console versions. The config field behind step 3 is `config.additionalModels` (`[{ modelKey, label?, description? }]`, max 10, unique, never the main model).

## Configure

```bash
cp .env.example .env     # then edit
npm install
```

| Variable | Meaning |
| --- | --- |
| `CONSOLE_BASE_URL` | Console origin, without `/api/client/v1`. |
| `CONSOLE_API_TOKEN` | Project API token (`cpeer_...`). |
| `AGENT_KEY` | Key of the agent with additional models. |
| `FORBIDDEN_MODEL_KEY` | Any model key the agent does **not** offer, to see `model_not_allowed`. |

## Run

```bash
node --env-file=.env --import tsx src/list-models.ts   # --env-file loads .env
node --env-file=.env --import tsx src/responses.ts
node --env-file=.env --import tsx src/chat-completions.ts
node --env-file=.env --import tsx src/sticky.ts
npm run typecheck
```

(`npm run <script>` works too if the variables are already exported in your shell.)

## Expected output (shape)

```
Agent "my-agent" offers 3 models:
- gpt-main  (default)  "GPT Main"
- fast-model  "Fast" - Quick answers
- deep-model  "Deep" - Hard reasoning

[asked: (nothing)] answered by gpt-main: ...
[asked: fast-model] answered by fast-model: ...
[asked: some-model-the-agent-does-not-offer] refused with 400 model_not_allowed: The model "..." is not offered by this agent
```

Sticky demo: turn 2 names no model yet `answered by` still shows the model chosen in turn 1.

## Notes

- `model` always names the **agent**; the chosen model is `agent_model`. On the OpenAI surface the response `model` stays the agent, and the answering model is `cognipeer.agent_model`.
- If a model is later removed from the agent's list, a session's remembered model quietly falls back to the main model.
- Streaming and background runs use the same fields; this example uses synchronous calls for clarity.
