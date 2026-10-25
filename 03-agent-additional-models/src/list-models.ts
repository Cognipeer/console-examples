// Which models can callers pick for this agent?  GET /agents/{agentKey} -> agent.models
import { config, getAgentModels, requireConfig } from "./client.js";

requireConfig();
const models = await getAgentModels(config.agentKey);

if (models.length === 0) {
  console.log(`Agent "${config.agentKey}" offers a single model (no additionalModels, or fewer than two remain).`);
} else {
  console.log(`Agent "${config.agentKey}" offers ${models.length} models:`);
  for (const m of models) {
    console.log(`- ${m.key}${m.default ? "  (default)" : ""}  "${m.label}"${m.description ? ` - ${m.description}` : ""}`);
  }
}
