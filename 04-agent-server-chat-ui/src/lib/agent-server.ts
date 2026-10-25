import { createAgentServer, createInMemoryProvider } from "@cognipeer/agent-server";
import { consoleAgentKey, consoleConfigured, loadConsoleAgent } from "./console-agent";
import { demoAgent } from "./demo-agent";

export const BASE_PATH = "/api/agents";

async function build() {
  const storage = createInMemoryProvider(); // use createPostgresProvider / createMongoDBProvider in production
  await storage.connect();

  const server = createAgentServer({
    basePath: BASE_PATH,
    storage,
    // Quick start without sign-in. In production configure `auth` / `resolveContext` instead.
    allowAnonymousList: true,
    auth: { enabled: false },
  });

  server.registerHostAgent(consoleConfigured ? await loadConsoleAgent() : demoAgent);
  return { server, agentId: consoleConfigured ? consoleAgentKey : demoAgent.info.id };
}

// One server per process (survives hot reloads in dev).
const g = globalThis as unknown as { __agentServer?: ReturnType<typeof build> };
export const getAgentServer = () => (g.__agentServer ??= build());
