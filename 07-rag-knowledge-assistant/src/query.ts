/**
 * Query the module with topK and minScore.
 *
 * POST /api/client/v1/rag/modules/{key}/query accepts `minScore` (matches
 * below it are dropped), but neither the OpenAPI spec nor SDK 3.1.0's
 * RagQueryRequest declares it yet, so this script calls the endpoint with fetch.
 * Usage: npm run query -- "how many vacation days do I get?"
 */
import { apiKey, baseUrl, fail, loadState } from './config.js';
import type { RagQueryResult } from '@cognipeer/console-sdk';

async function main() {
  const { moduleKey } = await loadState();
  const query = process.argv.slice(2).join(' ') || 'How many vacation days do I get?';

  const res = await fetch(`${baseUrl}/api/client/v1/rag/modules/${encodeURIComponent(moduleKey)}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      topK: 3,
      minScore: 0.3,
      // filter: { topic: 'remote-work' }, // metadata filter, see ingest.ts
    }),
  });
  if (!res.ok) {
    // 400 bad filter/body, 401 token, 404 module, 429 rate limit
    return fail(new Error(`Query failed with HTTP ${res.status}: ${await res.text()}`));
  }
  const { result } = (await res.json()) as { result: RagQueryResult };

  console.log(`Query: "${result.query}"  (topK ${result.topK}, ${result.latencyMs} ms)`);
  if (!result.matches.length) console.log('No match above minScore.');
  for (const m of result.matches) {
    console.log(`\n[${m.score.toFixed(3)}] ${m.fileName ?? m.id} #${m.chunkIndex ?? '-'}`);
    console.log((m.content ?? '').trim().slice(0, 300));
  }
}

main().catch(fail);
