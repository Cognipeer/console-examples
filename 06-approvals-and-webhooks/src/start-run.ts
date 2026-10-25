import { CognipeerAPIError, isAgentRunTerminal } from '@cognipeer/console-sdk';
import { makeClient } from './client.js';
import { requireEnv } from './config.js';

// Starts a BACKGROUND run of an agent that is set to ask before running tools.
// The run pauses (status "requires_action"); Console fires `action.required`, the receiver in
// server.ts answers it, and the same run continues. This script just watches the run.
const client = makeClient();
const agentKey = requireEnv('AGENT_KEY');
const prompt = process.argv.slice(2).join(' ') || 'Run the shell command `echo hello from the approval demo` in the sandbox and tell me its output.';

try {
  const run = await client.agents.responses.create(
    { model: agentKey, input: prompt, background: true },
    // Idempotency-Key makes a retry of this call return the same run instead of starting another.
    { idempotencyKey: `approval-demo-${Date.now()}` },
  );
  console.log(`Started ${run.id} (status ${run.status}). Waiting for the receiver to answer...`);

  let announcedPause = false;
  for (;;) {
    const current = await client.agents.runs.get(run.id);
    if (current.status === 'requires_action' && !announcedPause) {
      announcedPause = true;
      console.log('Run is paused for approval. The webhook receiver should answer it now.');
    }
    if (isAgentRunTerminal(current.status)) {
      console.log(`Run ${current.status}.`);
      console.log(JSON.stringify(current.result ?? null, null, 2));
      process.exit(current.status === 'succeeded' ? 0 : 1);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
} catch (err) {
  if (err instanceof CognipeerAPIError) {
    console.error(`${err.statusCode} ${err.errorCode ?? err.errorType ?? ''}: ${err.message}`);
    process.exit(1);
  }
  throw err;
}
