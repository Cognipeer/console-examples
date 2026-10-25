/**
 * Create the vector index, the Knowledge Engine (RAG) module and an agent that
 * searches it. Re-running is safe for the index (the API reports `reused`),
 * but the module key must be new (change RAG_MODULE_KEY or delete the module in
 * the UI to start over), and every run creates one more agent.
 */
import { client, fail, moduleKey, requireEnv, saveState } from './config.js';

async function main() {
  const providerKey = requireEnv('VECTOR_PROVIDER_KEY');
  const embeddingModelKey = requireEnv('EMBEDDING_MODEL_KEY');
  const chatModelKey = requireEnv('CHAT_MODEL_KEY');
  const dimension = Number(process.env.EMBEDDING_DIMENSION ?? 1536);

  // 1) Vector index on an existing vector provider.
  const { index, reused } = await client.vectors.indexes.create(providerKey, {
    name: `${moduleKey}-index`,
    dimension,
    metric: 'cosine',
  });
  console.log(`${reused ? 'Reusing' : 'Created'} vector index "${index.key}" (dimension ${dimension})`);

  // 2) Knowledge Engine module = embedding model + vector index + chunking.
  //    defaultTopK / defaultMinScore are accepted by POST /rag/modules but are not
  //    in the SDK 3.1.0 request type, hence the cast. They apply when a query
  //    does not pass its own topK / minScore.
  const { module } = await client.rag.createModule({
    key: moduleKey,
    name: 'Employee handbook (demo)',
    embeddingModelKey,
    vectorProviderKey: providerKey,
    vectorIndexKey: index.key,
    chunkConfig: { strategy: 'recursive_character', chunkSize: 600, chunkOverlap: 80 },
    defaultTopK: 5,
    defaultMinScore: 0.3,
  } as Parameters<typeof client.rag.createModule>[0]);
  console.log(`Created RAG module "${module.key}"`);

  // 3) Agent bound to the module. `knowledgeEngineKey` and `systemPrompt` are
  //    config fields the server accepts; the SDK 3.1.0 AgentConfig type only
  //    declares modelKey/temperature/topP/maxTokens, hence the cast.
  const agent = await client.agents.create({
    name: process.env.AGENT_NAME ?? 'Handbook assistant',
    description: 'Answers questions from the employee handbook',
    config: {
      modelKey: chatModelKey,
      temperature: 0.2,
      systemPrompt:
        'You answer questions about the employee handbook. Always search the knowledge engine first and cite the file name. If nothing relevant is found, say so.',
      knowledgeEngineKey: module.key,
    } as unknown as Parameters<typeof client.agents.create>[0]['config'],
  });
  // agents.chat() sends the agent key to POST /responses, which runs the PUBLISHED version.
  await client.agents.publish(agent.key, { changelog: 'Initial version' });
  console.log(`Created and published agent "${agent.key}"`);

  await saveState({ moduleKey: module.key, agentKey: agent.key, indexKey: index.key });
  console.log('\nNext: npm run ingest');
}

main().catch(fail);
