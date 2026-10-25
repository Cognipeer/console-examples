import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import { mintToken } from './token.js';
import { pageTools } from './tools.js';
import { users, type HostUser } from './users.js';

const app = express();
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use('/static', express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public')));

// ---- Fake login: an in-memory session store keyed by a random cookie. NOT for production. ----
const sessions = new Map<string, HostUser>();
const COOKIE = 'host_sid';

function currentUser(req: Request): HostUser | undefined {
  const sid = req.cookies?.[COOKIE] as string | undefined;
  return sid ? sessions.get(sid) : undefined;
}

function requireLogin(req: Request, res: Response, next: NextFunction): void {
  const user = currentUser(req);
  if (!user) {
    res.status(401).type('text/plain').send('Not signed in');
    return;
  }
  (req as Request & { user: HostUser }).user = user;
  next();
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

app.get('/login', (_req, res) => {
  const options = users.map((u) => `<option value="${esc(u.id)}">${esc(u.name)} (${esc(u.email)})</option>`).join('');
  res.type('html').send(`<!doctype html><meta charset="utf-8"><title>Fake login</title>
<body style="font-family:system-ui;max-width:420px;margin:80px auto">
<h1>Fake login</h1><p>Pick a demo user. A real host app would check a password or SSO here.</p>
<form method="post" action="/login"><select name="user">${options}</select> <button>Sign in</button></form></body>`);
});

app.post('/login', (req, res) => {
  const user = users.find((u) => u.id === req.body.user);
  if (!user) {
    res.status(400).send('Unknown user');
    return;
  }
  const sid = randomUUID();
  sessions.set(sid, user);
  res.cookie(COOKIE, sid, { httpOnly: true, sameSite: 'lax' }).redirect('/');
});

app.post('/logout', (req, res) => {
  const sid = req.cookies?.[COOKIE] as string | undefined;
  if (sid) sessions.delete(sid);
  res.clearCookie(COOKIE).redirect('/login');
});

// ---- The identity-token endpoint the widget calls from getToken() ----
// Mint a NEW token on every call: tokens are single-use, never cache one.
app.get('/api/cognipeer-token', requireLogin, async (req, res) => {
  try {
    const token = await mintToken((req as Request & { user: HostUser }).user);
    res.set('Cache-Control', 'no-store').type('text/plain').send(token);
  } catch (err) {
    console.error('Could not sign the token:', err);
    res.status(500).type('text/plain').send('Could not sign the token');
  }
});

// Handy for copying the tool declarations into the Embed tab.
app.get('/tools.json', (_req, res) => res.json(pageTools));

// ---- The host page ----
app.get('/', (req, res) => {
  const user = currentUser(req);
  if (!user) {
    res.redirect('/login');
    return;
  }
  // Passed to public/app.js. "<" is escaped so the JSON cannot close the script tag.
  const pageConfig = JSON.stringify({
    consoleUrl: config.consoleUrl,
    portal: config.portal,
    tenant: config.tenant,
    user: { name: user.name, email: user.email },
  }).replace(/</g, '\\u003c');

  res.type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Acme Shop (portal embed demo)</title>
<link rel="stylesheet" href="/static/app.css"></head>
<body>
<header><strong>Acme Shop</strong><span>Signed in as ${esc(user.name)}</span>
<form method="post" action="/logout"><button id="sign-out">Sign out</button></form></header>
<main>
  <section><h2>Your cart</h2><table id="cart"></table><p>Total: <span id="total"></span> USD</p></section>
  <section><h2>Ticket panel</h2><p id="ticket-panel">No ticket open. Ask the assistant: "open ticket T-1042".</p></section>
</main>
<script id="page-config" type="application/json">${pageConfig}</script>
<!-- 1. Load the widget (public, same for every workspace) -->
<script src="${esc(config.consoleUrl)}/api/embed/portal.v1.js"></script>
<!-- 2. Mount it and register the page tools -->
<script src="/static/app.js"></script>
</body></html>`);
});

app.listen(config.port, () => {
  console.log(`Host app on http://localhost:${config.port}  (portal "${config.portal}" of workspace "${config.tenant}")`);
  console.log(`Add this origin to the portal's Embed > Allowed sites: http://localhost:${config.port}`);
});
