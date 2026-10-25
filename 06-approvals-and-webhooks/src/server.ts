import express from 'express';
import { CognipeerAPIError } from '@cognipeer/console-sdk';
import { verifyWebhook, type KnownWebhookEvent, type WebhookEvent } from '@cognipeer/console-sdk/webhooks';
import { makeClient } from './client.js';
import { requireEnv } from './config.js';
import { decide } from './policy.js';

const secret = requireEnv('COGNIPEER_WEBHOOK_SECRET');
const client = makeClient();
const port = Number(process.env.PORT ?? 4000);

const app = express();

// Deliveries are retried until you answer 2xx, so the same event can arrive twice.
// In-memory is enough for a demo; use Redis or a unique DB key in production.
const seen = new Set<string>();

// IMPORTANT: express.raw, not express.json. The signature covers the exact bytes of the body.
app.post('/hooks/cognipeer', express.raw({ type: 'application/json', limit: '1mb' }), (req, res) => {
  const ok = verifyWebhook({
    rawBody: req.body as Buffer,
    signatureHeader: req.get('x-cognipeer-signature'), // "t=<unix>,v1=<hex>": HMAC-SHA256 of "<t>.<raw body>"
    secret,
    // toleranceSeconds defaults to 300; older/newer timestamps are rejected.
  });
  if (!ok) {
    console.warn('Rejected a delivery with a bad signature or timestamp');
    return res.sendStatus(400);
  }

  const event = JSON.parse((req.body as Buffer).toString('utf8')) as WebhookEvent;
  const webhookId = req.get('webhook-id') ?? event.id; // same value as x-cognipeer-event-id and body.id

  // Acknowledge first, work later: Console waits 10 s by default, then counts the delivery as failed and retries.
  res.sendStatus(204);

  if (seen.has(webhookId)) return;
  seen.add(webhookId);
  handle(event).catch((err) => console.error(`Handling ${event.type} (${webhookId}) failed:`, err));
});

// `WebhookEvent` also includes an "unknown type" arm, which defeats narrowing on `event.type`.
// Cast to the arm for each case instead (the type string is checked by the switch).
type Known<T extends string> = Extract<KnownWebhookEvent, { type: T }>;
type RunEvent = Extract<KnownWebhookEvent, { data: { runId: string } }>; // the agent_run.* family

async function handle(event: WebhookEvent): Promise<void> {
  switch (event.type) {
    case 'webhook.test':
      console.log('Test event received. Signature verification works.');
      return;

    case 'action.required': {
      // Thin event: ids only. data = { conversationId, agentKey, actionId, kind }.
      const { conversationId, actionId, kind } = (event as Known<'action.required'>).data;
      console.log(`Action required (${kind}) in session ${conversationId}, action ${actionId}`);
      await answer(conversationId, actionId);
      return;
    }

    case 'agent_run.requires_action':
      // Fires for a background run that paused. action.required fires too and does the answering;
      // this one is useful if you track runs rather than sessions.
      console.log(`Run ${(event as RunEvent).data.runId} is waiting for a person`);
      return;

    case 'agent_run.succeeded':
    case 'agent_run.failed':
    case 'agent_run.canceled': {
      const { runId, agentKey } = (event as RunEvent).data;
      console.log(`${event.type}: run ${runId} (agent ${agentKey})`);
      return;
    }

    default:
      // Unknown or uninteresting types: acknowledged above, nothing to do.
      return;
  }
}

async function answer(conversationId: string, actionId: string): Promise<void> {
  // The event does not carry the tool name or arguments (events never carry content),
  // so read the session to see what is pending.
  const session = await client.agents.sessions.get(conversationId);
  const action = session.pending_actions.find((a) => a.id === actionId);
  if (!action || action.status !== 'pending') {
    console.log(`Action ${actionId} is no longer pending, skipping`);
    return;
  }

  const body = decide(action);
  if (!body) {
    console.log(`Action ${actionId} (${action.kind}) is not handled by this receiver`);
    return;
  }

  try {
    // POST /api/client/v1/agents/sessions/{conversationId}/actions/{actionId}
    // The paused turn continues inline and this call returns the continuation.
    const next = await client.agents.sessions.actions.resolve(conversationId, actionId, body);
    console.log(`Answered ${actionId}:`, JSON.stringify(body), '-> response status', next.status);
  } catch (err) {
    if (!(err instanceof CognipeerAPIError)) throw err;
    switch (err.errorCode) {
      case 'action_not_pending': // someone else answered first
      case 'action_cancelled': //   withdrawn meanwhile (new message, run cancelled, timeout policy)
      case 'action_expired': //     410, ran out of time
        console.log(`Action ${actionId} was already settled (${err.errorCode}), nothing to do`);
        return;
      case 'action_forbidden': //   403, the token's owner is not an allowed approver
        console.error('403 action_forbidden: use a token owned by an eligible approver, or change "Who can answer".');
        return;
      case 'invalid_resolution': // 400, the request stays open
        console.error('400 invalid_resolution: the answer does not fit the action:', err.message);
        return;
      case 'action_not_found':
      case 'session_not_found':
        console.error(`404 ${err.errorCode}: wrong project for this token?`);
        return;
      default:
        throw err;
    }
  }
}

app.get('/healthz', (_req, res) => res.send('ok'));

app.listen(port, () => {
  console.log(`Webhook receiver listening on http://localhost:${port}/hooks/cognipeer`);
  console.log('Console cannot reach localhost: expose it with a tunnel and register the public URL (see README).');
});
