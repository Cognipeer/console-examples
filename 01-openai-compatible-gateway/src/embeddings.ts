import { client, describeError } from './client.js';

const model = process.env.CONSOLE_EMBEDDING_MODEL;
if (!model) {
  console.error('Set CONSOLE_EMBEDDING_MODEL to the key of an embedding model.');
  process.exit(1);
}

try {
  const res = await client.embeddings.create({
    model,
    input: ['Hello world', 'How are you?'],
  });
  for (const item of res.data) {
    console.log(`#${item.index}: ${item.embedding.length} dimensions, first values`, item.embedding.slice(0, 3));
  }
  console.log('usage:', res.usage);
} catch (err) {
  console.error(describeError(err));
  process.exitCode = 1;
}
