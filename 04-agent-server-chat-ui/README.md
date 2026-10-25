# 04 - Agent server + chat UI with a model picker

A Next.js (App Router) app that serves an agent through `@cognipeer/agent-server` 0.4.0 and renders it with `@cognipeer/chat-ui` 0.5.0.

When the agent advertises two or more `models`, `<Chat>` shows a **ModelPicker** next to the send button and sends the pick as `model` with each message. Each answer carries an **"Answered with <model>"** footer.

## What it shows

- `src/lib/console-agent.ts` - a host agent (`registerHostAgent`) backed by a **Cognipeer Console agent**. At start-up it reads `GET /agents/{key}` and reuses `agent.models` as `AgentInfo.models`; on each turn it forwards the picked model as `agent_model` to `POST /agents/responses` and continues the Console conversation with `previous_response_id`.
- `src/lib/demo-agent.ts` - an offline host agent with a **static models list**. Used automatically when `CONSOLE_*` variables are not set, so the app runs without Console.
- `src/app/api/agents/[...path]/route.ts` - `createNextRouteHandlers` mounted at `/api/agents`.
- `src/app/chat-client.tsx` - `<Chat baseUrl="/api/agents" agentId=... showAnsweredWith />`.

agent-server validates the pick: a model that is not in `AgentInfo.models` is refused with `400 model_not_allowed` (the response lists the allowed keys) before your agent runs.

### Variant: a local agent-sdk agent

Instead of a host agent you can register a local agent with `server.registerSDKAgent(id, agent, { id, name, models: [...], selectModel })`. `models` is a static list and `selectModel({ model, conversationId, context })` is called before a turn so your code can switch the agent's model. The agent instance is shared by all conversations, so serialize turns yourself if the hook mutates it. This example does not include that variant (it would need a model provider key); see the `@cognipeer/agent-server` README, section on `AgentInfo.models`.

## Prerequisites

- Node.js 20.9+ (required by Next.js 16)
- Optional, for Console mode: a Console project with a published agent that has **additional models**.

## Console setup (UI, optional)

1. **Settings > API Tokens**: create a token (`cpeer_...`).
2. **Build -> Agents**: open or create an agent, set its main **Model**, add **Additional models** (at least one), and **Publish** it.
3. Copy the agent key.

(Same setup as example `03-agent-additional-models`.)

## Configure and run

```bash
npm install
cp .env.example .env.local     # the CONSOLE_* values start empty = offline demo agent; fill in all three for Console mode
npm run dev                    # http://localhost:3000
npm run build && npm run typecheck   # verification
```

| Variable | Meaning |
| --- | --- |
| `CONSOLE_BASE_URL` | Console origin, without `/api/client/v1`. |
| `CONSOLE_API_TOKEN` | Console API token. Used only on the server, never sent to the browser. |
| `CONSOLE_AGENT_KEY` | Key of the Console agent to front. |

## Expected result

- Offline demo: the composer shows a picker with "Demo Main" and "Demo Fast". Send "hello" with "Demo Fast" and the reply is `(demo-fast) You said: hello`, with "Answered with Demo Fast" below it.
- Console mode: the picker lists the agent's main and additional models; replies come from the chosen model and the footer shows it.
- If the agent has a single model, no picker appears.

Quick API check (offline demo): `curl localhost:3000/api/agents/agents/demo` returns `models`; posting a message with `"model": "zzz"` returns `400 model_not_allowed`.

## Notes

- Storage is in-memory (`createInMemoryProvider`), so conversations vanish on restart. Use PostgreSQL, MongoDB or SQLite for real use.
- `allowAnonymousList: true` and `auth.enabled: false` are quick-start settings. Add authentication and `resolveContext` before exposing this, and keep the Console token on the server.
- The agent server is built lazily on first request, so `next build` never contacts Console.
- `npm install` prints `ERESOLVE overriding peer dependency` warnings: two dependencies of `@cognipeer/chat-ui` 0.5.0 (`lucide-react` and `react-intl`) declare peer ranges up to React 18, while this example uses React 19. The install and `npm run build` succeed.
- Checked with `next start`: the page renders on the server and the `/api/agents` routes answer as described above, both in the offline demo and in Console mode against a stand-in HTTP server. The chat UI was not exercised in a browser.
