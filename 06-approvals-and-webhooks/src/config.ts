// Reads configuration from the environment (Node 20.6+: `node --env-file=.env`, or `tsx --env-file=.env`).
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing environment variable ${name}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
  return value;
}
