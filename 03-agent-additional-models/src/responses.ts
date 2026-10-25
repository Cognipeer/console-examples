// POST /agents/responses with `agent_model`. `model` is the AGENT key; `agent_model` picks which model answers.
import { ApiError, api, config, getAgentModels, outputText, requireConfig } from "./client.js";

requireConfig();

interface AgentResponse {
  id: string;
  model: string;
  // Present when the agent offers several models: the model that answered.
  cognipeer?: { agent_model?: string };
  output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }>;
}

async function ask(agentModel: string | undefined, prompt: string): Promise<void> {
  try {
    const resp = await api<AgentResponse>("/agents/responses", {
      body: { model: config.agentKey, input: prompt, ...(agentModel ? { agent_model: agentModel } : {}) },
    });
    console.log(`[asked: ${agentModel ?? "(nothing)"}] answered by ${resp.cognipeer?.agent_model ?? "(single-model agent)"}:`);
    console.log(`  ${outputText(resp).slice(0, 200)}\n`);
  } catch (e) {
    if (e instanceof ApiError && e.code === "model_not_allowed") {
      console.log(`[asked: ${agentModel}] refused with 400 model_not_allowed: ${e.message}\n`);
      return;
    }
    throw e;
  }
}

const models = await getAgentModels(config.agentKey);
const [main, ...others] = models;

await ask(undefined, "Say hello in one sentence."); // nothing asked -> main model (new session)
for (const m of others.length ? others : main ? [main] : []) {
  await ask(m.key, "Say hello in one sentence."); // explicit choice
}
await ask(config.forbiddenModel, "This must be refused."); // not on the agent's list -> 400 model_not_allowed

// Same thing with the header instead of the body field (the body wins when both are sent):
const viaHeader = await api<AgentResponse>("/agents/responses", {
  headers: { "X-Cognipeer-Agent-Model": (others[0] ?? main)?.key ?? "" },
  body: { model: config.agentKey, input: "Hello via header" },
});
console.log(`[header] answered by ${viaHeader.cognipeer?.agent_model ?? "(single-model agent)"}`);
