/**
 * The page tools this example registers (handlers live in public/app.js).
 * Declare the SAME names in Console: Operate > Portals > your portal > Embed > Tools in your page > Add a tool.
 * GET /tools.json serves this list so you can copy the fields.
 */
export const pageTools = [
  {
    name: 'page_get_cart_total',
    description: 'Returns the total of the shopping cart the person currently has open on this page, in the requested currency.',
    inputSchema: {
      type: 'object',
      properties: { currency: { type: 'string', enum: ['USD', 'EUR'] } },
      required: ['currency'],
      additionalProperties: false,
    },
    waitSeconds: 30,
    askThePersonFirst: false, // read-only
  },
  {
    name: 'page_open_ticket',
    description: 'Opens a support ticket in the ticket panel of this page so the person can see it. Use it when the person asks to look at a ticket.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', pattern: '^T-[0-9]{4}$' } },
      required: ['id'],
      additionalProperties: false,
    },
    waitSeconds: 30,
    askThePersonFirst: true, // it changes what the person sees: mark every state-changing tool
  },
] as const;
