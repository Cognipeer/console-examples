# 06 - Approvals and webhooks

An Express receiver for Console **webhooks** that answers an agent's **approval requests and questions** through the client API, plus a script that starts a run which needs approval.

## What it shows

- Verifying the `x-cognipeer-signature` header (`t=<unix>,v1=<hex>`, HMAC-SHA256 over `"<t>.<raw body>"`) with `verifyWebhook` from `@cognipeer/console-sdk/webhooks`, over the raw body.
- Deduplicating on `webhook-id` and acknowledging with 2xx before doing any work.
- Handling `action.required` (kind `tool_approval` or `user_question`): read the session's pending actions, decide, and answer with `POST /api/client/v1/agents/sessions/{conversationId}/actions/{actionId}` (`client.agents.sessions.actions.resolve`).
- Handling the documented error codes: `action_not_pending`, `action_cancelled`, `action_expired`, `action_forbidden`, `invalid_resolution`, `action_not_found`, `session_not_found`.
- Starting a background run (`background: true`) that pauses with status `requires_action`.

Files:

| File | Purpose |
| --- | --- |
| `src/server.ts` | The webhook receiver (`POST /hooks/cognipeer`). |
| `src/policy.ts` | The one function to replace with your own approval logic. The demo denies a tool call whose arguments contain a `DENY_PATTERNS` entry, allows everything else, and answers a question with its first option. |
| `src/start-run.ts` | Starts a background run and watches it until it finishes. |

## Prerequisites

- Node.js 20.6 or newer (uses `--env-file`).
- A Console project, an API token, and an agent that asks before running tools.
- A public URL for the receiver. Console refuses webhook URLs that resolve to private addresses, so `localhost` does not work: use a tunnel (for example `cloudflared tunnel --url http://localhost:4000` or `ngrok http 4000`).

## Console setup

1. **Agent.** Open **Build > Agents ->** your agent **-> Build**, scroll to **Approvals & questions** and turn on **Ask before tools run** (and, if you want questions, **Let the agent ask the user questions**). Give the agent a tool that changes something (for example the sandbox). Then **publish** the agent: a published version keeps the settings it was published with, and API traffic uses the published version. Under **Who can answer** keep the default (**The session owner and project admins**) and make sure the API token's owner qualifies.
2. **Background runs.** `start-run.ts` uses `background: true`. Any call can run in the background, so the agent needs no extra setting.
3. **API token.** Create a project API token and put it in `COGNIPEER_API_TOKEN`.
4. **Webhook.** Go to **Build > Agents > Webhooks > New webhook**. URL: `https://<your-tunnel>/hooks/cognipeer`. Scope: **This project only**. Events: tick the **Approvals and questions** group (`action.*`) and, optionally, **Background runs** (`agent_run.*`). Click **Create webhook**, copy the `whsec_...` secret (shown once) into `COGNIPEER_WEBHOOK_SECRET`, then **I have copied the secret**.
5. After the receiver is running, use the row menu **Send test event** on the webhook.

## Run

```bash
cp .env.example .env     # fill in the values
npm install
npm start                # terminal 1: the receiver
npm run start-run        # terminal 2: starts a run that needs approval
npm run start-run -- "Delete the build folder in the sandbox"   # custom prompt
```

## Expected output

Receiver, after **Send test event**:

```text
Test event received. Signature verification works.
```

Receiver, during a run that uses a gated tool:

```text
Action required (tool_approval) in session 6f1c0a2b9d3e4f5a6b7c8d9e, action act_0123456789abcdef01234567
Answered act_0123456789abcdef01234567: {"decision":"allow"} -> response status completed
agent_run.succeeded: run run_... (agent ops-agent)
```

`start-run`:

```text
Started resp_... (status queued). Waiting for the receiver to answer...
Run is paused for approval. The webhook receiver should answer it now.
Run succeeded.
{ ...the Responses-shaped result... }
```

If the arguments match `DENY_PATTERNS`, the receiver sends `{ "decision": "deny", "comment": "..." }` and the agent reads the refusal.

## Notes

- Events are thin (ids only). The tool name and arguments come from `GET /agents/sessions/{id}` (`pending_actions`).
- A run has two public ids: `resp_<id>` is the response returned when it starts, `run_<id>` is the run id in `agent_run.*` events. `GET /agents/runs/{id}` accepts both.
- If the receiver is down, Console retries on a schedule over about two days; the pending request stays open until the agent's **Wait for an answer** time runs out (default 1440 minutes, then **When time runs out** applies).
- A request is answered once. A second answer gets `409 action_not_pending`; after the timeout `410 action_expired`.
- Page tools (`client_tool`) cannot be answered by a server receiver: only the person's browser may supply their output. See example 05.
- A per-run `callback_url` is signed the same way but has a different body (`{ id, event, createdAt, runId, ... }`), so this route is for webhook subscriptions only.
- This demo keeps the dedupe set in memory; use a durable store in production.
