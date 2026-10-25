/**
 * Step 1 - turn an OpenAPI spec into MCP tools on Console.
 *
 * POST /api/client/v1/mcp (via client.mcp.createServer) discovers one tool per
 * operation. The server is then reachable at /api/client/v1/mcp/{key}/... for
 * any MCP client holding an API token (exposure.accessMode = "token").
 */
import { readFile } from 'node:fs/promises';
import { ConsoleClient, CognipeerError } from '@cognipeer/console-sdk';
import { baseUrl, requireEnv } from './config.js';

const client = new ConsoleClient({ apiKey: requireEnv('CONSOLE_API_KEY'), baseURL: baseUrl });

async function main() {
  const spec = await readFile(new URL('../openapi/weather.yaml', import.meta.url), 'utf8');

  const server = await client.mcp.createServer({
    name: 'Weather demo',
    key: process.env.MCP_SERVER_KEY,
    description: 'Open-Meteo forecast exposed as an MCP tool',
    sourceType: 'openapi',
    openApiSpec: spec,
    upstreamBaseUrl: 'https://api.open-meteo.com', // optional, the spec already has servers[]
    upstreamAuth: { type: 'none' }, // none | token | header | basic
    // Enable both transports. "sse" is what mcp-client.ts uses by default.
    exposure: { protocols: ['sse', 'streamable-http'], accessMode: 'token' },
  // `key` is accepted by POST /api/client/v1/mcp but is not in the SDK 3.1.0 request type, hence the cast.
  } as Parameters<typeof client.mcp.createServer>[0]);

  console.log(`Created MCP server "${server.key}" (${server.tools.length} tools):`);
  for (const t of server.tools) console.log(`  - ${t.name}: ${t.description ?? ''}`);
  console.log(`\nSSE endpoint: ${baseUrl}/api/client/v1/mcp/${server.key}/sse`);
  console.log(`Next: MCP_SERVER_KEY=${server.key} npm run client`);
}

main().catch((err) => {
  if (err instanceof CognipeerError) {
    // 400 invalid body / spec, 401 bad token, 402 enterprise-only option, 403 forbidden
    console.error(`Console error ${err.statusCode ?? ''}: ${err.message}`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
