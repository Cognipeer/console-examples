// Tiny shared helper: config from env + a fetch wrapper for the Console client API.
const base = (process.env.CONSOLE_BASE_URL ?? "").replace(/\/+$/, "");
const token = process.env.CONSOLE_API_TOKEN ?? "";

export const config = {
  apiBase: `${base}/api/client/v1`,
  token,
  agentKey: process.env.AGENT_KEY ?? "",
  forbiddenModel: process.env.FORBIDDEN_MODEL_KEY ?? "not-a-listed-model",
};

export function requireConfig(): void {
  const missing = [
    !base && "CONSOLE_BASE_URL",
    !token && "CONSOLE_API_TOKEN",
    !config.agentKey && "AGENT_KEY",
  ].filter(Boolean);
  if (missing.length) {
    console.error(`Missing env: ${missing.join(", ")} (copy .env.example to .env and run with --env-file=.env)`);
    process.exit(1);
  }
}

/** One entry of AgentSummary.models (GET /agents/{agentKey}). */
export interface AgentModel {
  key: string;
  label: string;
  description?: string;
  default: boolean;
}

/** Error thrown for any non-2xx answer; `code` is the API error code, e.g. "model_not_allowed". */
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string | undefined, message: string) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  const res = await fetch(`${config.apiBase}${path}`, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    // Console errors are `{ error: { message, code } }` (OpenAI-shaped); be tolerant of a flat shape too.
    const err = json?.error ?? json;
    throw new ApiError(res.status, err?.code, err?.message ?? `HTTP ${res.status}`);
  }
  return json as T;
}

/** Fetch the models an agent offers; empty when it has a single model (the field is then absent). */
export async function getAgentModels(agentKey: string): Promise<AgentModel[]> {
  const { agent } = await api<{ agent: { models?: AgentModel[] } }>(`/agents/${encodeURIComponent(agentKey)}`);
  return agent.models ?? [];
}

/** Text of the first assistant message in a Responses-API style `output`. */
export function outputText(resp: {
  output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }>;
}): string {
  return (resp.output ?? [])
    .filter((o) => o.type === "message")
    .flatMap((o) => o.content ?? [])
    .map((c) => c.text ?? "")
    .join("");
}
