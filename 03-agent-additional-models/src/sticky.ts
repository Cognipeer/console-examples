// Sticky model: a session remembers the model last chosen. Later messages that name no model keep using it.
// Rule (agentModelSelection): requested model > the session's last model (if still offered) > the main model.
import { api, config, getAgentModels, outputText, requireConfig } from "./client.js";

requireConfig();

interface AgentResponse {
  id: string;
  cognipeer?: { agent_model?: string };
  output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }>;
}

const models = await getAgentModels(config.agentKey);
const other = models.find((m) => !m.default);
if (!other) {
  console.log("This agent offers a single model, nothing to demo.");
  process.exit(0);
}

// 1) Create an empty session (nothing runs, nothing is spent), then reuse it with `session_id`.
const session = await api<{ id: string }>("/agents/sessions", { body: { agent: config.agentKey } });

const turn = async (prompt: string, agentModel?: string) => {
  const r = await api<AgentResponse>("/agents/responses", {
    body: { model: config.agentKey, session_id: session.id, input: prompt, ...(agentModel ? { agent_model: agentModel } : {}) },
  });
  console.log(`  asked=${agentModel ?? "-"}  answered by=${r.cognipeer?.agent_model}  -> ${outputText(r).slice(0, 80)}`);
};

console.log("Turn 1: explicitly pick a non-default model");
await turn("Remember the number 7.", other.key);
console.log("Turn 2: name nothing -> the session keeps the model from turn 1");
await turn("What number did I ask you to remember?");
console.log("Turn 3: switch back to the main model");
await turn("And now?", models.find((m) => m.default)?.key);
