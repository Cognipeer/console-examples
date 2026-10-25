import { client, chatModel, describeError } from './client.js';

try {
  const res = await client.chat.completions.create({
    model: chatModel, // a Console model KEY
    messages: [
      { role: 'system', content: 'You are a concise assistant.' },
      { role: 'user', content: 'What is the capital of France?' },
    ],
    temperature: 0.2,
  });
  console.log(res.choices[0]?.message.content);
  console.log('usage:', res.usage);
  // Console adds a correlation id to the body (see "request_id" in the OpenAPI spec).
  console.log('request_id:', (res as unknown as { request_id?: string }).request_id);
} catch (err) {
  console.error(describeError(err));
  process.exitCode = 1;
}
