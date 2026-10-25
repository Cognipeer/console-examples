/**
 * Example 1 - OpenTelemetry (OTLP/HTTP JSON) straight to Console.
 *
 * Console accepts OTLP/HTTP *JSON* at POST {base}/api/client/v1/traces.
 * @opentelemetry/exporter-trace-otlp-http sends JSON by default (not protobuf),
 * which is exactly what the endpoint expects. Console normalises the span
 * attributes server-side; here we use the current OTel GenAI conventions.
 *
 * No real LLM is called: the "agent" below is simulated so you can see the
 * trace shape (agent -> model call -> tool call) without any model setup.
 */
import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { BasicTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { baseUrl, requireEnv } from './config.js';

const apiKey = requireEnv('COGNIPEER_API_KEY');

const exporter = new OTLPTraceExporter({
  url: `${baseUrl}/api/client/v1/traces`,
  headers: { authorization: `Bearer ${apiKey}` },
});

const provider = new BasicTracerProvider({
  resource: resourceFromAttributes({ 'service.name': 'otlp-demo-agent' }),
  spanProcessors: [new BatchSpanProcessor(exporter)],
});
const tracer = provider.getTracer('console-examples/otlp');

// Attribute names follow the "OTel GenAI" column of the Console attribute mapping.
const threadId = `conv-${Date.now()}`;

async function main() {
  await tracer.startActiveSpan('invoke_agent otlp-demo-agent', { kind: SpanKind.INTERNAL }, async (root) => {
    root.setAttributes({
      'gen_ai.operation.name': 'invoke_agent',
      'gen_ai.conversation.id': threadId, // becomes the Console thread id
    });

    // 1) model call that asks for a tool
    await tracer.startActiveSpan('chat gpt-4.1-mini', { kind: SpanKind.CLIENT }, async (span) => {
      span.setAttributes({
        'gen_ai.operation.name': 'chat',
        'gen_ai.conversation.id': threadId,
        'gen_ai.request.model': 'gpt-4.1-mini',
        'gen_ai.response.model': 'gpt-4.1-mini',
        'gen_ai.system_instructions': JSON.stringify([{ type: 'text', content: 'You are a support bot.' }]),
        'gen_ai.input.messages': JSON.stringify([
          { role: 'user', parts: [{ type: 'text', content: 'Where is order 1042?' }] },
        ]),
        'gen_ai.output.messages': JSON.stringify([
          {
            role: 'assistant',
            parts: [{ type: 'tool_call', id: 'call_1', name: 'lookup_order', arguments: { id: '1042' } }],
          },
        ]),
        'gen_ai.tool.definitions': JSON.stringify([
          {
            name: 'lookup_order',
            description: 'Look up an order by id',
            parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
          },
        ]),
        'gen_ai.usage.input_tokens': 120,
        'gen_ai.usage.output_tokens': 18,
      });
      span.end();
    });

    // 2) the tool execution
    await tracer.startActiveSpan('execute_tool lookup_order', async (span) => {
      span.setAttributes({
        'gen_ai.operation.name': 'execute_tool',
        'gen_ai.tool.name': 'lookup_order',
        'gen_ai.tool.call.result': JSON.stringify({ status: 'shipped', eta: '2 days' }),
      });
      span.end();
    });

    // 3) final answer
    await tracer.startActiveSpan('chat gpt-4.1-mini', { kind: SpanKind.CLIENT }, async (span) => {
      span.setAttributes({
        'gen_ai.operation.name': 'chat',
        'gen_ai.conversation.id': threadId,
        'gen_ai.request.model': 'gpt-4.1-mini',
        'gen_ai.input.messages': JSON.stringify([
          { role: 'user', parts: [{ type: 'text', content: 'Where is order 1042?' }] },
          { role: 'tool', parts: [{ type: 'tool_call_response', id: 'call_1', response: { status: 'shipped' } }] },
        ]),
        'gen_ai.output.messages': JSON.stringify([
          { role: 'assistant', parts: [{ type: 'text', content: 'Order 1042 has shipped and arrives in 2 days.' }] },
        ]),
        'gen_ai.usage.input_tokens': 160,
        'gen_ai.usage.output_tokens': 14,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    });

    root.end(); // ending the root span closes the Console session
  });

  // Flush before the process exits, otherwise the batch processor may drop spans.
  try {
    await provider.forceFlush();
    await provider.shutdown();
    console.log(`Sent trace. Open Agent Observability -> Threads and look for thread "${threadId}".`);
  } catch (err) {
    // 400 invalid payload, 401/403 token problems, 413 too large, 429 quota exceeded
    console.error('OTLP export failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

main();
