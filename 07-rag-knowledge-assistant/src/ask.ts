/**
 * Ask the agent. It has the module attached as its knowledge engine, so it
 * searches it itself and answers from the retrieved passages.
 * Usage: npm run ask -- "Can I carry over vacation days?"
 */
import { client, fail, loadState } from './config.js';

async function main() {
  const { agentKey } = await loadState();
  const question = process.argv.slice(2).join(' ') || 'Can I carry over unused vacation days?';

  const first = await client.agents.chat(agentKey, { message: question });
  console.log(`Q: ${question}\nA: ${first.content}`);
  if (first.status) console.log(`(turn status: ${first.status})`);

  // Follow-up in the same conversation.
  const second = await client.agents.chat(agentKey, {
    message: 'And when do they expire?',
    conversationId: first.conversationId,
  });
  console.log(`\nQ: And when do they expire?\nA: ${second.content}`);
}

main().catch(fail);
