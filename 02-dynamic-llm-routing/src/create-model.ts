// OPTIONAL: create the Dynamic LLM from code instead of the UI.
// Uses POST /api/client/v1/models/dynamic. NOTE: this route is implemented in the server
// (src/server/api/plugins/client-models.ts in the Console repository) but is NOT listed in its openapi.yaml.
// The Model Hub > Dynamic LLM UI is the documented path (see README).
import { readFileSync } from 'node:fs';
import { apiToken, baseUrl } from './client.js';

const dynamic = JSON.parse(readFileSync(new URL('../example-config.json', import.meta.url), 'utf8'));

const res = await fetch(`${baseUrl}/models/dynamic`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${apiToken}` },
  body: JSON.stringify({
    name: 'Smart router',
    key: process.env.CONSOLE_DYNAMIC_MODEL ?? 'smart-router',
    description: 'Example rule-based Dynamic LLM',
    dynamic,
  }),
});
const body = await res.text();
if (!res.ok) {
  // 400 carries the validation message, e.g. unknown model key in the routing config.
  console.error(`HTTP ${res.status}: ${body}`);
  process.exit(1);
}
console.log('Created:', body);
