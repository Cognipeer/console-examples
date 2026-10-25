# 05 - Portal embed host

A small Express "host application" that embeds a Console **portal** as a chat bubble, signs the visitor in with a **host-signed identity token**, and registers **page tools** the agent can call in the visitor's browser.

> Portals and embedding are part of the **enterprise** edition. The workspace needs an enterprise licence.

## What it shows

- A fake login (two demo users) so the example runs on its own.
- `GET /api/cognipeer-token`: the server mints an HS256 JWT for the signed-in user with `jose`. Claims follow the Console verifier: `iss` (exactly the Embed tab's Issuer), `aud` = `cognipeer-portal:<portal key>`, `sub`, `iat`, `exp` (120 s, below the portal's "Longest token lifetime"), a fresh `jti` per token (a token works once), and optional `email` / `email_verified` / `name` / `groups` / `ctx`. The `kid` header names the secret, and the secret is used as UTF-8 text, never base64-decoded.
- The widget (`/api/embed/portal.v1.js`) mounted in bubble mode with `getToken`, `tools`, `context`, events and `logout()` on sign-out.
- Two page tools, `page_get_cart_total` (read-only) and `page_open_ticket` (changes the page, so it should be declared with **Ask the person first**), with handlers that validate their arguments.

| File | Purpose |
| --- | --- |
| `src/server.ts` | Fake login, token endpoint, the host page. |
| `src/token.ts` | Token minting (the part to copy into your own app). |
| `src/tools.ts` | The tool declarations to enter in Console (also served at `/tools.json`). |
| `public/app.js` | Browser code: `CognipeerPortal.mount(...)` and the tool handlers. |

## Prerequisites

- Node.js 20.6 or newer.
- A Console workspace with an enterprise licence, and a portal that is enabled and has at least one published agent.
- A site address the browser can use for the host. `http://localhost` works as an allowed site **only on development and self-hosted installations**; on SaaS use an `https` address (for example a tunnel).

## Console setup

1. **Allowed site.** Go to **Operate > Portals > your portal > Embed**. Under **Allowed sites** press **Add a site** and enter this app's origin, for example `http://localhost:3000` (exact origin, no path).
2. **Token signing.** Under **Token signing**, keep **Algorithm** on **HS256 (shared secret)**. Set **Issuer** to the value of `EMBED_ISSUER` (default `http://localhost:3000`). Press **Generate a secret**, and copy the value (`cps_...`) and its key id (`sec_...`) into `EMBED_SECRET` and `EMBED_KEY_ID`. The secret is shown once.
3. **Who the token is.** Under **Who the token is**, the defaults match people by verified email. The demo users have `email_verified: true`; either create Console members with those addresses (`ada@example.com`, `sam@example.com`), or set **When nobody matches** to **Create an external account**. Also check the portal's access list (**People who arrive through the embed**).
4. **Page tools.** Under **Tools in your page** press **Add a tool** twice, using the fields from `GET http://localhost:3000/tools.json` (or `src/tools.ts`):
   - `page_get_cart_total`: description, input schema, **Wait for the page** 30, **Ask the person first** off.
   - `page_open_ticket`: description, input schema, **Wait for the page** 30, **Ask the person first** on.
5. **May use the page's tools.** Open the portal's **Chat features** tab, find the agent and turn on **May use the page's tools** (it shows while embedding is on). It is off by default: an agent that is not switched on in this portal never receives page tools, whatever the portal declares. The rule belongs to the portal, per agent.
6. Switch **Allow embedding** on and **Save**.
7. Publish the agent if you changed it, and give it instructions that tell it when to use the tools (the model reads each tool's description).

## Run

```bash
cp .env.example .env     # fill in CONSOLE_URL, COGNIPEER_TENANT, COGNIPEER_PORTAL, EMBED_*
npm install
npm start
```

Open `http://localhost:3000`, pick a user, press the **Ask** bubble and try:

- "What is my cart total in euros?" calls `page_get_cart_total`.
- "Open ticket T-1042" shows an approval card first (the tool is declared with **Ask the person first**), then updates the ticket panel.

## Expected output

Terminal:

```text
Host app on http://localhost:3000  (portal "support" of workspace "acme")
Add this origin to the portal's Embed > Allowed sites: http://localhost:3000
```

Browser console, once the chat is open:

```text
Assistant signed in as ada@example.com
Agent action required: { kind: 'client_tool', actionId: 'act_...', tool: 'page_get_cart_total' }
Agent action resolved: { kind: 'client_tool', ..., ok: true, durationMs: 12 }
```

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Bubble shows a sign-in problem, `auth:error` in the console | Issuer differs from the Embed tab (a trailing slash counts), wrong `EMBED_KEY_ID`, secret base64-decoded or truncated, `aud` mismatch (portal key, or the workspace form when "Require the workspace in the audience" is on), or the page origin is not in **Allowed sites**. The event carries a reference code; the Embed tab's troubleshooting section lists every code. |
| `token_replayed` | The same token was exchanged twice. This example mints a new `jti` on every request; do not add caching to the token route. |
| The agent never calls a tool | The agent's **May use the page's tools** switch is off in this portal, the tool is not declared, or its description does not tell the model when to use it. |
| "The host page did not answer" | The handler took longer than **Wait for the page**, or the tab was hidden or closed. |
| Tools missing on `/p/<key>` | By design: page tools exist only in embedded sessions. |

## Security notes

- The signing secret stays on the server. Never put it in `public/` or any browser code.
- A page tool's result is typed in the person's browser, so the agent is told it is untrusted. Never return an authorization decision from a tool; put trusted facts in the signed `ctx` claim and enforce permissions on your server.
- `context` in `mount` is unsigned page information, not identity.
- The fake login keeps sessions in memory and is for demonstration only.
