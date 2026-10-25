# Cognipeer Console examples

Runnable example projects for [Cognipeer Console](https://docs.cognipeer.com). Each folder is a self-contained project with its own `README.md`, `package.json` and `.env.example`. The matching use-case pages in the Console documentation link here.

## Prerequisites

- A Cognipeer Console workspace (SaaS or self-hosted) and its base URL.
- An API token from your workspace (used as the bearer key against `<base>/api/client/v1`).
- Node.js 22 or newer for examples 01, 02, 03 and 09 (the `openai` package requires it), and Node.js 20.9 or newer for the others. Example 01 also ships a Python variant that needs Python 3.10 or newer.
- Example-specific resources (a model, an agent, a vector provider, a portal) are described in each README.

## Examples

| Folder | What it shows | Language | Console features |
| --- | --- | --- | --- |
| [01-openai-compatible-gateway](01-openai-compatible-gateway) | Official OpenAI SDKs pointed at Console: chat, streaming, tool calls, embeddings, guardrail block handling | TypeScript, Python | Client API gateway, Model Hub, guardrails |
| [02-dynamic-llm-routing](02-dynamic-llm-routing) | A rule-based Dynamic LLM that routes by request signals; which model answered each prompt | TypeScript | Dynamic LLM, routing rules, request logs |
| [03-agent-additional-models](03-agent-additional-models) | Letting the caller pick which of an agent's models answers | TypeScript | Agents, additional models, Responses API |
| [04-agent-server-chat-ui](04-agent-server-chat-ui) | Next.js app with an agent server and a chat UI with a model picker | TypeScript (Next.js) | Agents, additional models |
| [05-portal-embed-host](05-portal-embed-host) | Host page embedding a portal chat bubble with signed identity and page tools | TypeScript, JavaScript | Portals (enterprise), embed widget, client tools |
| [06-approvals-and-webhooks](06-approvals-and-webhooks) | Webhook receiver that verifies signatures and resolves tool approvals | TypeScript | Webhooks, approvals, background runs |
| [07-rag-knowledge-assistant](07-rag-knowledge-assistant) | Vector index, Knowledge Engine module, ingest, query and an agent bound to it | TypeScript | Knowledge Index, Knowledge Engine, agents |
| [08-mcp-tool-gateway](08-mcp-tool-gateway) | Expose an OpenAPI spec as an MCP server and call it with an MCP client | TypeScript | MCP servers |
| [09-tracing-observability](09-tracing-observability) | Send OTLP spans and trace a LangChain agent | TypeScript | Agent Observability (tracing) |

## Run an example

```bash
cd 01-openai-compatible-gateway
cp .env.example .env      # fill in the base URL and API token
npm install
npm run typecheck         # optional; see the example's package.json scripts
```

Then follow the commands in the example's README. Note that `tsx` does not load `.env` by itself, so several examples run with `node --env-file=.env --import tsx src/<file>.ts`.

## Status and versions

These examples were typechecked (`npx tsc --noEmit`) against pinned dependency versions, for example `openai` 7.x, `@cognipeer/console-sdk` 3.1.0, `@cognipeer/agent-server` 0.4.0, `@cognipeer/chat-ui` 0.5.0, `@cognipeer/observability` 0.2.1 and `@modelcontextprotocol/sdk` 1.32.x. Newer releases exist for some of these packages (for example `@cognipeer/console-sdk` 4.0.0); the examples stay on the versions pinned in each `package-lock.json` and have not been migrated. They have not all been run against a live Console. Each README lists what was verified and what to double-check, such as UI labels that may differ between versions.

## License

MIT, see [LICENSE](LICENSE).

Questions or enterprise support: [developer@cognipeer.com](mailto:developer@cognipeer.com)
