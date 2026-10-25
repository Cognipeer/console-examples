/**
 * Step 2 - use the Console MCP endpoint with the standard MCP client SDK.
 *
 * Transports exposed by Console for a server key:
 *   SSE              GET  /api/client/v1/mcp/{key}/sse     (+ POST .../message?sessionId=...)
 *   streamable HTTP  POST /api/client/v1/mcp/{key}/sse     (stateless JSON-RPC)
 * Auth for both: "Authorization: Bearer cpeer_...".
 * Each transport must be enabled in the server's exposure settings.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { baseUrl, requireEnv } from './config.js';

const apiKey = requireEnv('CONSOLE_API_KEY');
const serverKey = process.env.MCP_SERVER_KEY ?? 'console';
const url = new URL(`${baseUrl}/api/client/v1/mcp/${serverKey}/sse`);
const headers = { Authorization: `Bearer ${apiKey}` };

function createTransport() {
  if (process.env.MCP_TRANSPORT === 'streamable-http') {
    return new StreamableHTTPClientTransport(url, { requestInit: { headers } });
  }
  return new SSEClientTransport(url, {
    // The SSE GET (EventSource) and the message POSTs both need the token.
    requestInit: { headers },
    eventSourceInit: {
      fetch: (input, init) => fetch(input, { ...init, headers: { ...(init?.headers as Record<string, string>), ...headers } }),
    },
  });
}

async function main() {
  const client = new Client({ name: 'console-examples-mcp-client', version: '1.0.0' });
  await client.connect(createTransport());
  console.log('Connected to', client.getServerVersion());

  const { tools } = await client.listTools();
  console.log(`\n${tools.length} tool(s) on "${serverKey}":`);
  for (const t of tools) console.log(`  - ${t.name}: ${t.description ?? ''}`);

  const toolName = process.env.MCP_TOOL || undefined;
  if (toolName) {
    const args = JSON.parse(process.env.MCP_TOOL_ARGS || '{}') as Record<string, unknown>;
    const result = await client.callTool({ name: toolName, arguments: args });
    if (result.isError) console.error('Tool returned an error:');
    console.log(JSON.stringify(result.content, null, 2));
  } else {
    console.log('\nSet MCP_TOOL (and MCP_TOOL_ARGS) in .env to call one.');
  }
  await client.close();
}

main().catch((err) => {
  // JSON-RPC codes: -32001 server not found, -32002 disabled. HTTP: 401 token, 403 disabled/protocol off, 404 key.
  console.error('MCP client failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
