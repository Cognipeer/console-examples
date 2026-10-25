import type OpenAI from 'openai';
import { client, chatModel, describeError } from './client.js';

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get the current weather for a city.',
      parameters: {
        type: 'object',
        properties: { city: { type: 'string' } },
        required: ['city'],
      },
    },
  },
];

// Fake local implementation: the model asks, WE run the function.
function getWeather(city: string) {
  return { city, tempC: 18, condition: 'cloudy' };
}

try {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'user', content: 'What is the weather in Istanbul right now?' },
  ];

  // Round trip 1: the model replies with tool_calls.
  const first = await client.chat.completions.create({ model: chatModel, messages, tools });
  const assistant = first.choices[0]?.message;
  if (!assistant?.tool_calls?.length) {
    console.log('Model answered directly:', assistant?.content);
  } else {
    messages.push(assistant);
    for (const call of assistant.tool_calls) {
      if (call.type !== 'function') continue;
      const args = JSON.parse(call.function.arguments || '{}') as { city?: string };
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(getWeather(args.city ?? 'unknown')),
      });
    }
    // Round trip 2: send tool results back, get the final answer.
    const second = await client.chat.completions.create({ model: chatModel, messages, tools });
    console.log(second.choices[0]?.message.content);
  }
} catch (err) {
  console.error(describeError(err));
  process.exitCode = 1;
}
