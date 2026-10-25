import { ConsoleClient } from '@cognipeer/console-sdk';
import { requireEnv } from './config.js';

// baseURL is the Console origin: the SDK builds /api/client/v1/... paths itself.
export function makeClient(): ConsoleClient {
  return new ConsoleClient({
    apiKey: requireEnv('COGNIPEER_API_TOKEN'),
    baseURL: requireEnv('CONSOLE_URL'),
  });
}
