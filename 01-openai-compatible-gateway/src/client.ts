import OpenAI from 'openai';

function need(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env var ${name}. Copy .env.example to .env and load it (e.g. node --env-file=.env).`);
    process.exit(1);
  }
  return v;
}

/** The only Console-specific part: baseURL + API token as the key. */
export const client = new OpenAI({
  baseURL: `${need('CONSOLE_BASE_URL').replace(/\/+$/, '')}/api/client/v1`,
  apiKey: need('CONSOLE_API_TOKEN'),
});

export const chatModel = need('CONSOLE_CHAT_MODEL');

/** Pull the Console guardrail details out of an OpenAI SDK error, if present. */
export function describeError(err: unknown): string {
  if (err instanceof OpenAI.APIError) {
    // Before streaming starts, Console answers HTTP 400 with
    //   { error: { type: 'guardrail_block', guardrail_key, action, findings, message } }.
    // Mid-stream, the same kind of error arrives as an in-band frame
    //   { error: { type: 'guardrail_block', code, message, guardrail_key } },
    // which the SDK raises as an APIError whose `status` is undefined (there is no HTTP status to report).
    const e = err.error as
      | { type?: string; message?: string; code?: string; guardrail_key?: string; action?: string; findings?: unknown }
      | undefined;
    if (e?.type === 'guardrail_block' && (err.status === 400 || err.status === undefined)) {
      const when = err.status === undefined ? ' while streaming' : '';
      const action = e.action ? ` (action: ${e.action})` : '';
      const findings = e.findings ? `\nfindings: ${JSON.stringify(e.findings)}` : '';
      return `Blocked by guardrail "${e.guardrail_key}"${when}${action}: ${e.message}${findings}`;
    }
    if (err.status === 401) return 'Unauthorized: check CONSOLE_API_TOKEN.';
    if (err.status === 429) return 'Rate limit or quota exceeded (HTTP 429).';
    return err.status === undefined ? err.message : `HTTP ${err.status}: ${err.message}`;
  }
  return err instanceof Error ? err.message : String(err);
}
