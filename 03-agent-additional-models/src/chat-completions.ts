// OpenAI-compatible surface: POST /chat/completions with model "agent:<key>".
// `agent_model` is not an OpenAI field. The TypeScript SDK serializes the params object as given, so an extra property reaches the server.
import OpenAI from "openai";
import { config, getAgentModels, requireConfig } from "./client.js";

requireConfig();

const client = new OpenAI({ apiKey: config.token, baseURL: config.apiBase });
const models = await getAgentModels(config.agentKey);
const pick = (models.find((m) => !m.default) ?? models[0])?.key;
if (!pick) {
  console.log("This agent offers a single model, nothing to choose.");
  process.exit(0);
}

type Completion = OpenAI.Chat.Completions.ChatCompletion & { cognipeer?: { agent_model?: string } };

// Variant A: body field. The cast only keeps TypeScript from rejecting the extra `agent_model` property.
const a = (await client.chat.completions.create(
  { model: `agent:${config.agentKey}`, messages: [{ role: "user", content: "Say hi." }], ...({ agent_model: pick } as object) },
)) as Completion;
console.log(`[body]   model=${a.model} answered by ${a.cognipeer?.agent_model}: ${a.choices[0]?.message.content}`);

// Variant B: header (the body wins if both are present).
const b = (await client.chat.completions.create(
  { model: `agent:${config.agentKey}`, messages: [{ role: "user", content: "Say hi." }] },
  { headers: { "X-Cognipeer-Agent-Model": pick } },
)) as Completion;
console.log(`[header] model=${b.model} answered by ${b.cognipeer?.agent_model}: ${b.choices[0]?.message.content}`);

// Refused choice: OpenAI-shaped 400 { error: { type: "invalid_request_error", code: "model_not_allowed" } }
try {
  await client.chat.completions.create({
    model: `agent:${config.agentKey}`,
    messages: [{ role: "user", content: "x" }],
    ...({ agent_model: config.forbiddenModel } as object),
  });
} catch (e) {
  if (e instanceof OpenAI.APIError && e.status === 400 && e.code === "model_not_allowed") {
    console.log(`[refused] 400 model_not_allowed: ${e.message}`);
  } else {
    throw e;
  }
}
