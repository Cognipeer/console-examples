import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { ConsoleClient, CognipeerError } from '@cognipeer/console-sdk';

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
  return value;
}

export const baseUrl = (process.env.CONSOLE_BASE_URL ?? 'https://console.cognipeer.com').replace(/\/+$/, '');
export const apiKey = requireEnv('CONSOLE_API_KEY');
export const client = new ConsoleClient({ apiKey, baseURL: baseUrl });
export const moduleKey = process.env.RAG_MODULE_KEY ?? 'handbook-demo';

/** Keys written by `npm run setup` so the other scripts know what to use. */
export interface State {
  moduleKey: string;
  agentKey: string;
  indexKey: string;
}
const STATE_FILE = new URL('../.state.json', import.meta.url);

export async function saveState(state: State) {
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}
export async function loadState(): Promise<State> {
  try {
    return JSON.parse(await readFile(STATE_FILE, 'utf8')) as State;
  } catch {
    console.error('No .state.json found. Run `npm run setup` first.');
    process.exit(1);
  }
}

/** Print a Console API error the way the documented status codes read. */
export function fail(err: unknown): never {
  if (err instanceof CognipeerError) {
    // 400 invalid body, 401 bad token, 404 unknown key, 429 rate/quota.
    // A module key that already exists comes back as 500 with an "already exists" message.
    console.error(`Console error ${err.statusCode ?? ''}: ${err.message}`);
  } else {
    console.error(err);
  }
  process.exit(1);
}
