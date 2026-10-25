// A "host agent" that forwards each turn to a Cognipeer Console agent.
// The Console agent (config.additionalModels) tells us which models exist; the chat UI's pick arrives as
// `input.model` and is forwarded as `agent_model` on POST /agents/responses.
import type { AgentModelOption, HostAgentDefinition } from "@cognipeer/agent-server";

const base = (process.env.CONSOLE_BASE_URL ?? "").replace(/\/+$/, "");
const token = process.env.CONSOLE_API_TOKEN ?? "";
export const consoleAgentKey = process.env.CONSOLE_AGENT_KEY ?? "";
export const consoleConfigured = Boolean(base && token && consoleAgentKey);

async function consoleFetch(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${base}/api/client/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = json?.error ?? {};
    throw Object.assign(new Error(e.message ?? `Console answered ${res.status}`), { code: e.code, status: res.status });
  }
  return json;
}

/** The agent's description and its models, read once at start-up (GET /agents/{key} -> agent.models). */
export async function loadConsoleAgent(): Promise<HostAgentDefinition> {
  const { agent } = await consoleFetch(`/agents/${encodeURIComponent(consoleAgentKey)}`);
  // `models` is absent when the agent offers fewer than two; the chat UI then shows no picker.
  const models: AgentModelOption[] | undefined = agent.models;

  // Console conversation to continue per agent-server conversation (resp_<conversationId> ids).
  const lastResponse = new Map<string, string>();

  return {
    info: {
      id: consoleAgentKey,
      name: agent.name ?? consoleAgentKey,
      description: agent.description ?? undefined,
      ...(models ? { models } : {}),
    },
    async invoke(input, io) {
      const body = await consoleFetch("/agents/responses", {
        method: "POST",
        signal: io.signal,
        body: JSON.stringify({
          model: consoleAgentKey,
          input: input.message,
          // The user's pick. agent-server already rejected keys outside `models` with 400 model_not_allowed;
          // Console checks again and would answer 400 model_not_allowed too.
          ...(input.model ? { agent_model: input.model } : {}),
          ...(lastResponse.has(input.conversationId) ? { previous_response_id: lastResponse.get(input.conversationId) } : {}),
        }),
      });
      lastResponse.set(input.conversationId, body.id);
      const text = (body.output ?? [])
        .filter((o: any) => o.type === "message")
        .flatMap((o: any) => o.content ?? [])
        .map((c: any) => c.text ?? "")
        .join("");
      // `usage.model` lets agent-server record which model answered ("Answered with" footer).
      return { content: text, usage: { model: body.cognipeer?.agent_model ?? input.model } };
    },
  };
}
