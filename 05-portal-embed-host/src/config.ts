function need(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing environment variable ${name}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
  return v;
}

export const config = {
  consoleUrl: need('CONSOLE_URL').replace(/\/$/, ''),
  tenant: need('COGNIPEER_TENANT'),
  portal: need('COGNIPEER_PORTAL'),
  issuer: need('EMBED_ISSUER'),
  keyId: need('EMBED_KEY_ID'),
  // The secret is used EXACTLY as shown in Console: its UTF-8 bytes, never base64-decoded.
  secret: new TextEncoder().encode(need('EMBED_SECRET')),
  requireWorkspaceAud: process.env.EMBED_REQUIRE_WORKSPACE_AUD === 'true',
  port: Number(process.env.PORT ?? 3000),
};
