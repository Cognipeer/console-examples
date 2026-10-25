/**
 * Example 2 - LangChain agent traced with @cognipeer/observability.
 *
 * The model is called through the Console gateway (OpenAI-compatible
 * /api/client/v1/chat/completions), and the CognipeerCallbackHandler reports
 * every model call, tool call and token count to Console Tracing.
 */
import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import { HumanMessage, SystemMessage, ToolMessage, type BaseMessage } from '@langchain/core/messages';
import { RunnableLambda } from '@langchain/core/runnables';
import { awaitAllCallbacks } from '@langchain/core/callbacks/promises';
import { z } from 'zod';
import { init, flush } from '@cognipeer/observability';
import { cognipeerConfig } from '@cognipeer/observability/langchain';
import { baseUrl, requireEnv } from './config.js';

const apiKey = requireEnv('COGNIPEER_API_KEY');
const modelKey = requireEnv('CONSOLE_MODEL_KEY');

// Reads COGNIPEER_API_KEY / COGNIPEER_BASE_URL; the agent name labels the session.
init({ apiKey, baseUrl, agent: { name: 'support-bot' } });

const lookupOrder = tool(
  async ({ id }) => JSON.stringify({ id, status: 'shipped', eta: '2 days' }),
  {
    name: 'lookup_order',
    description: 'Look up an order by id',
    schema: z.object({ id: z.string() }),
  },
);

const model = new ChatOpenAI({
  model: modelKey,
  apiKey,
  configuration: { baseURL: `${baseUrl}/api/client/v1` },
  streamUsage: true, // so token counts are reported
}).bindTools([lookupOrder]);

// One RunnableLambda = one root run = one Console session containing every step.
const agent = RunnableLambda.from(async (question: string, config) => {
  const messages: BaseMessage[] = [
    new SystemMessage('You are a support bot. Use tools when needed.'),
    new HumanMessage(question),
  ];
  for (let step = 0; step < 4; step++) {
    const ai = await model.invoke(messages, config);
    messages.push(ai);
    if (!ai.tool_calls?.length) return String(ai.content);
    for (const call of ai.tool_calls) {
      const result = await lookupOrder.invoke(call.args as { id: string }, config);
      messages.push(new ToolMessage({ content: String(result), tool_call_id: call.id ?? '' }));
    }
  }
  return 'Stopped after 4 steps.';
});

async function main() {
  // cognipeerConfig attaches the handler AND plumbs the thread id correctly
  // for every langchain-core version (see the LangChain page, "Thread grouping").
  const answer = await agent.invoke('Where is order 1042?', cognipeerConfig('conv-42'));
  console.log('Answer:', answer);

  // Required on serverless; harmless in a script. Make sure all spans were sent.
  await awaitAllCallbacks();
  await flush();
  console.log('Traces flushed. Open Agent Observability -> Sessions, agent "support-bot".');
}

main().catch((err) => {
  console.error('Run failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
