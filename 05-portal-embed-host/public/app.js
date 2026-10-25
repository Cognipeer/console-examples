// Runs in the browser. Loaded after the Console widget script (window.CognipeerPortal).
const config = JSON.parse(document.getElementById('page-config').textContent);

// ---- Page state the tools read and change ----
const cart = [
  { name: 'Mechanical keyboard', usd: 120 },
  { name: 'USB-C dock', usd: 85.5 },
];
const EUR_PER_USD = 0.92; // demo rate

document.getElementById('cart').innerHTML = cart.map((i) => `<tr><td>${i.name}</td><td>${i.usd.toFixed(2)}</td></tr>`).join('');
document.getElementById('total').textContent = cart.reduce((s, i) => s + i.usd, 0).toFixed(2);

// ---- Handlers for the page tools declared in the portal (Embed > Tools in your page) ----
// Signature: (args, { callId, name }) => JSON-serialisable value (or a promise of one), at most 64 KB.
// Throwing returns an error result to the agent; the turn goes on either way.
// The arguments were written by the MODEL: validate them even though the portal checked the schema,
// and never eval them or build selectors/queries from them.
const tools = {
  page_get_cart_total: async (args) => {
    const currency = args && args.currency;
    if (currency !== 'USD' && currency !== 'EUR') throw new Error('currency must be USD or EUR');
    const usd = cart.reduce((s, i) => s + i.usd, 0);
    const total = currency === 'USD' ? usd : usd * EUR_PER_USD;
    return { total: Number(total.toFixed(2)), currency };
  },

  page_open_ticket: async (args) => {
    const id = args && args.id;
    if (typeof id !== 'string' || !/^T-[0-9]{4}$/.test(id)) throw new Error('id must look like T-1042');
    // textContent, not innerHTML: the value came from a model.
    document.getElementById('ticket-panel').textContent = `Ticket ${id} is open.`;
    location.hash = `#/tickets/${id}`;
    return { opened: id };
  },
};

if (!window.CognipeerPortal) {
  console.error('The widget script did not load. Check CONSOLE_URL and that the console is reachable from the browser.');
} else {
  const assistant = window.CognipeerPortal.mount({
    portal: config.portal, // the portal's key
    tenant: config.tenant, // your workspace slug
    mode: 'bubble',
    launcherText: 'Ask',
    // Called when the chat starts and before every renewal. Always fetch a FRESH token.
    getToken: async () => {
      const response = await fetch('/api/cognipeer-token', { credentials: 'include', cache: 'no-store' });
      if (!response.ok) throw new Error('Could not get a token (' + response.status + ')');
      return response.text();
    },
    tools,
    // Unsigned info about what the person is looking at. Never use it for access decisions.
    context: { page: 'shop', cartItems: cart.length },
  });

  if (assistant) {
    assistant
      .on('ready', ({ user }) => console.log('Assistant signed in as', user && user.email))
      .on('auth:error', ({ code, reference }) => console.warn('Assistant sign-in problem:', code, reference))
      .on('action:required', (e) => console.log('Agent action required:', e))
      .on('action:resolved', (e) => console.log('Agent action resolved:', e));

    // End the embedded session on the server when the person signs out of this app.
    document.getElementById('sign-out').addEventListener('click', () => assistant.logout());
  }
}
