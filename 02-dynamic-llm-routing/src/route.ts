import OpenAI from 'openai';
import { client, need } from './client.js';

const router = need('CONSOLE_DYNAMIC_MODEL'); // key of the Dynamic LLM

// A long prompt to push the estimated input tokens over the rule threshold (300; chars/4).
const longText = 'Summarize the following policy text in one sentence. '.concat(
  'Employees may work remotely up to three days per week with manager approval. '.repeat(25),
);

// 1x1 transparent PNG, enough to trigger the hasImages signal.
const tinyPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

type Case = { name: string; expect: string; params: Omit<OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming, 'model'> };

const cases: Case[] = [
  {
    name: 'short prompt',
    expect: 'api-short-to-fast',
    params: { messages: [{ role: 'user', content: 'Say hi in five words.' }], max_tokens: 30 },
  },
  {
    name: 'long prompt',
    expect: 'api-long-prompts-to-strong',
    params: { messages: [{ role: 'user', content: longText }], max_tokens: 60 },
  },
  {
    name: 'keyword "refund"',
    expect: 'refund-keyword-to-premium',
    params: { messages: [{ role: 'user', content: 'A customer asks for a refund. Draft a one-line reply.' }], max_tokens: 60 },
  },
  {
    name: 'image attached',
    expect: 'images-to-vision',
    params: {
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is in this image?' },
            { type: 'image_url', image_url: { url: tinyPng } },
          ],
        },
      ],
      max_tokens: 60,
    },
  },
];

console.log(`Dynamic LLM: ${router}\n`);
for (const c of cases) {
  try {
    const res = await client.chat.completions.create({ model: router, ...c.params });
    // `res.model` carries the id of the concrete model that answered, not the router key.
    console.log(`[${c.name}] expected rule: ${c.expect}`);
    console.log(`  answered by: ${res.model}`);
    console.log(`  tokens: ${res.usage?.total_tokens ?? '?'}  request_id: ${(res as unknown as { request_id?: string }).request_id}`);
  } catch (err) {
    if (err instanceof OpenAI.APIError) {
      // e.g. 400 guardrail_block, 429 quota, or a router budget guard set to onExceeded: "reject"
      console.error(`[${c.name}] HTTP ${err.status}: ${err.message}`);
    } else {
      throw err;
    }
  }
}
console.log('\nThe routing reason per request is visible in the Console UI: Model Hub > your Dynamic LLM > Routing tab (also on the Logs tab, route chat.completions.router).');
