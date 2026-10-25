# 02 - Dynamic LLM routing

A **Dynamic LLM** is a virtual chat model in Console. Clients call it like any other model key through the OpenAI SDK, and Console
decides, per request, which concrete model answers. This example creates a rule-based router and sends prompts that hit different rules.

**Console features shown:** Model Hub > Dynamic LLM, routing signals and caller conditions, fallback model, the Routing tab and request logs.

## How routing works

- **Strategy** `rule-based`: ordered rules, **first match wins**. Each rule has `conditions` combined with `matchType` (`all` or `any`)
  and points at a fixed model (`targetModelKey`) or at a pool (`target: { pool: [{modelKey, tier}], policy }` with policy
  `best-under-cap`, `cheapest` or `token-profile`). If no rule matches, `defaultModelKey` (or `defaultTarget`) is used.
  `fallbackModelKey` is used if the chosen model errors.
- **Strategy** `model-based`: a **decider** model (a `decision`-category model) classifies the request into one of your `decider.labels`
  (each label maps to a model or pool); `minConfidence` / `belowConfidence` send unsure answers to a safe target.
- **Request signals** usable in rules: `inputTokensEst`, `messageCount`, `lastUserLength`, `hasTools`, `hasResponseFormat`, `hasImages`,
  `conversationCostUsd`, `budgetUsedPct`, `predictedOutputTokens`, `ioRatio`, `complexityScore` (needs a `complexity` decision model), `keyword`
  (operators `contains` / `matches`). Numeric signals use `gt gte lt lte eq neq`; boolean ones `isTrue isFalse`.
- **Caller conditions** (who is asking, through which door): `channel` (`dashboard | portal | messaging | api | embed | a2a | schedule | playground`),
  `userId`, `groupIds`, `agentKey`, `portalKey`, `apiTokenId`, `projectId`. These accept only `in` / `not_in` with a list of values.
  A rule on a field the caller did not supply simply does not match.
- **Guards** (optional): `maxCostPerRequestUsd`, `conversationBudgetUsd`, `budget`, `economyModelKey`; `mode: "shadow"` logs decisions without enforcing.

### Important: what an API-token call looks like to the router

Requests to `/api/client/v1/chat/completions` carry the caller context `channel = "api"`, `apiTokenId` and `projectId` only
(per the server source). There is **no `userId` and no `groupIds`** on this path, so the group rule in the example config
never matches over the OpenAI SDK. It fires for callers that have an identity: the dashboard Playground, portals and agent runs.
The example keeps that rule to show the syntax and uses channel / token-size / keyword / image rules for what `route.ts` demonstrates.

## Prerequisites

Four LLM models in your project (any models you like), with these keys: `fast-model`, `balanced-model`, `strong-model`,
`premium-model`, and a multimodal-capable `vision-model`. Use other keys if you prefer, then edit `example-config.json`.
All routing targets must be `llm` models and exist in the same project.

## Console setup (UI)

1. Open **Model Hub**, then **Dynamic LLM** in the sub-nav (a shortcut to the model list filtered to Dynamic LLM routers), and create a new Dynamic LLM
   (key `smart-router`).
2. Choose the **rule-based** strategy and paste/recreate the config from [`example-config.json`](./example-config.json):

```json
{
  "strategy": "rule-based",
  "defaultModelKey": "balanced-model",
  "fallbackModelKey": "balanced-model",
  "rules": [
    { "label": "images-to-vision", "matchType": "all", "targetModelKey": "vision-model",
      "conditions": [{ "signal": "hasImages", "operator": "isTrue" }] },
    { "label": "refund-keyword-to-premium", "matchType": "all", "targetModelKey": "premium-model",
      "conditions": [{ "signal": "keyword", "operator": "contains", "value": "refund" }] },
    { "label": "support-group-to-premium", "matchType": "all", "targetModelKey": "premium-model",
      "conditions": [{ "signal": "groupIds", "operator": "in", "value": ["REPLACE_WITH_GROUP_ID"] }] },
    { "label": "api-long-prompts-to-strong", "matchType": "all", "targetModelKey": "strong-model",
      "conditions": [
        { "signal": "channel", "operator": "in", "value": ["api"] },
        { "signal": "inputTokensEst", "operator": "gt", "value": 300 }
      ] },
    { "label": "api-short-to-fast", "matchType": "all", "targetModelKey": "fast-model",
      "conditions": [{ "signal": "channel", "operator": "in", "value": ["api"] }] }
  ]
}
```

   Rules are ordered: image and keyword rules come first, then the group rule, then the two `api` channel rules.
   Replace `REPLACE_WITH_GROUP_ID` with a real user-group id (or delete that rule).
3. Save. Console validates the config (at least one rule, known signals, caller signals only with `in`/`not_in`, known channels,
   all model keys exist and are LLM models, a router cannot target itself).
4. **Settings -> API Tokens**: create a token for the same project.

Alternative (not in the OpenAPI spec): `npm run create` posts the same config to `POST /api/client/v1/models/dynamic`, a route present in
the server source. The UI route above is the documented path.

## Run

```bash
cp .env.example .env     # fill in
npm install
node --env-file=.env --import tsx src/route.ts
npm run typecheck
```

## Expected output

```
Dynamic LLM: smart-router

[short prompt] expected rule: api-short-to-fast
  answered by: <provider id of fast-model>
  tokens: 28  request_id: ...
[long prompt] expected rule: api-long-prompts-to-strong
  answered by: <provider id of strong-model>
...
```

## Seeing which model answered, and why

- **In the response**: `response.model` is the **provider model id of the concrete model that answered** (source: the child call builds the
  response with `model.modelId`; the router returns it untouched), not the router key. If two of your models share the same provider model id
  they are indistinguishable here. The documented `request_id` in the body correlates the call with the logs.
- **The routing reason** (matched rule, decision, fallback) is **not** returned to the client and no documented client API (OpenAPI spec)
  exposes it. It is stored on the router's log row. Find it in the Console UI: open the Dynamic LLM from Model Hub and use its **Routing** tab
  (routed-to model, decision and reason; open a row for the signals that were computed). The same decisions appear on the **Logs** tab under
  the route `chat.completions.router`, and the child call has its own row. `GET /analytics/usage?group_by=model` (documented) shows per-model
  call and spend totals, which confirms the traffic split.
- Streaming works the same way: set `stream: true`; the concrete model appears in the chunks' `model` field.

## Files

- `example-config.json` - the routing config
- `src/route.ts` - sends 4 prompts through the OpenAI SDK and prints the answering model
- `src/create-model.ts` - optional creation via API (undocumented route)
- `src/client.ts` - shared client

Not verified against a live server: only type-checked offline.
