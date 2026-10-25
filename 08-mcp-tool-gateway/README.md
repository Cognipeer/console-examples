# 08 - MCP tool gateway

Expose tools through Console as an MCP server and consume them from any MCP client.

1. `npm run register` - registers an **OpenAPI spec** (`openapi/weather.yaml`, Open-Meteo) as an MCP server. Console creates one tool per operation.
2. `npm run client` - connects with the official `@modelcontextprotocol/sdk` client, lists the tools and optionally calls one.

Console features: **MCP Servers** (OpenAPI source), token-authenticated MCP endpoint (SSE and streamable HTTP), tool annotations.

## Prerequisites

- Node.js 20+
- A Console project and an API token with access to the MCP service

## Console setup

1. **Settings -> API Tokens -> Create Token**, enable the MCP service, copy the token.
2. Either run `npm run register` (creates the server through the API), or create it in the UI: **Build -> MCP Servers -> New MCP server**, source type **OpenAPI spec**, paste `openapi/weather.yaml`, upstream authentication **None**, then under **Endpoint exposure** enable **SSE (legacy)** (and **Streamable HTTP (JSON-RPC)**) with access mode **API token required**. Note the server **key**.

## Configure and run

```bash
cp .env.example .env     # edit values
npm install
npm run register         # prints the server key and its tools
MCP_SERVER_KEY=weather-demo MCP_TOOL=getForecast \
  MCP_TOOL_ARGS='{"latitude":52.52,"longitude":13.41}' npm run client
npm run typecheck
```

| Variable | Meaning |
|---|---|
| `CONSOLE_BASE_URL` | Console base URL (no `/api/client/v1`) |
| `CONSOLE_API_KEY` | API token |
| `MCP_SERVER_KEY` | Server key to create / connect to. `console` targets the built-in Console MCP server |
| `MCP_TOOL`, `MCP_TOOL_ARGS` | Tool to call and its JSON arguments; empty `MCP_TOOL` only lists tools |
| `MCP_TRANSPORT` | `sse` (default) or `streamable-http` |

## Expected output

```
Created MCP server "weather-demo" (1 tools):
  - getForecast: Returns the current weather for the given latitude and longitude.
...
Connected to { name: 'cognipeer-mcp-gateway', version: '1.0.0' }
1 tool(s) on "weather-demo":
  - getForecast: ...
[ { "type": "text", "text": "{ ...current_weather... }" } ]
```

## Endpoints used

| Purpose | Request |
|---|---|
| Create server | `POST /api/client/v1/mcp` (`sourceType: "openapi"`, `openApiSpec`, `upstreamAuth`, `exposure`) |
| SSE stream | `GET /api/client/v1/mcp/{serverKey}/sse` -> `endpoint` event with the POST URL |
| JSON-RPC | `POST /api/client/v1/mcp/{serverKey}/message?sessionId=...` (`initialize`, `tools/list`, `tools/call`, `ping`) |
| Streamable HTTP | `POST /api/client/v1/mcp/{serverKey}/sse` (sessionless JSON-RPC) |
| Plain REST | `GET` / `POST /api/client/v1/mcp/{serverKey}/execute` with `{ "tool", "arguments" }` |

Authentication is always `Authorization: Bearer cpeer_...`.

## Publishing through an MCP server

The registered server *is* the publication: any MCP client (Claude Desktop, Cursor, OpenAI MCP connector, your own agent) can point at `https://<console>/api/client/v1/mcp/<key>/sse` with the bearer token. Tune what clients see in the server's **Tools** tab (disable tools, reword descriptions, override annotations) or via `PATCH /api/client/v1/mcp/{serverKey}` with `toolAnnotations` / `toolDescriptions`. Every tool is served with the full `annotations` block that strict clients require. A server whose exposure access mode is `public` also gets an unauthenticated path under `/api/public/mcp/{tenantId}/{endpointSlug}/sse`; only do that for tools that are safe for anyone to call.

## Errors

| Status / code | Meaning |
|---|---|
| 400 | Invalid body, missing `tool`, invalid spec |
| 401 | Invalid API token |
| 403 | Server disabled, or that transport is disabled in the server's exposure |
| 404 | Unknown server key |
| 502 | Upstream tool execution failed |
| -32001 / -32002 | JSON-RPC: server not found / disabled |

## Notes

- The SSE `endpoint` event carries a path and query (`/api/client/v1/mcp/{serverKey}/message?sessionId=...`), not an absolute URL, so the MCP client resolves it against the URL it opened the stream on. Point clients at the public URL of your Console.
- Not run against a live Console. The scripts are type-checked, and both transports (SSE and streamable HTTP) were run against a stand-in server built on the MCP SDK's own server transports.
