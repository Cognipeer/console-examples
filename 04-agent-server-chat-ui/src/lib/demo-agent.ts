// Offline demo: a host agent with a STATIC models list. No Console, no LLM - it just says which model it was asked to use.
// Swap `invoke` for a call to your own backend (or use `sdkAgent` + `selectModel` for a local agent-sdk agent).
import type { AgentModelOption, HostAgentDefinition } from "@cognipeer/agent-server";

export const demoModels: AgentModelOption[] = [
  { key: "demo-main", label: "Demo Main", description: "Default model", default: true },
  { key: "demo-fast", label: "Demo Fast", description: "Cheaper and quicker", default: false },
];

export const demoAgent: HostAgentDefinition = {
  info: { id: "demo", name: "Demo agent", description: "Echoes the model you picked", models: demoModels },
  invoke(input) {
    const model = input.model ?? demoModels.find((m) => m.default)!.key;
    return { content: `(${model}) You said: ${input.message}`, usage: { model } };
  },
};
