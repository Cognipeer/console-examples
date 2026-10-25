import { client, chatModel, describeError } from './client.js';

try {
  const stream = await client.chat.completions.create({
    model: chatModel,
    messages: [{ role: 'user', content: 'Write a two-sentence story about a lighthouse.' }],
    stream: true,
  });
  for await (const chunk of stream) {
    // Some frames Console sends carry no `choices` (see "Streaming" in the README), so guard the access.
    process.stdout.write(chunk.choices?.[0]?.delta?.content ?? '');
  }
  process.stdout.write('\n');
} catch (err) {
  // A guardrail block found before streaming starts is a normal HTTP 400. One found mid-stream
  // arrives as an in-band error frame, which the SDK raises as an APIError without an HTTP status.
  process.stdout.write('\n');
  console.error(describeError(err));
  process.exitCode = 1;
}
