import 'dotenv/config';

/** Read a required environment variable or exit with a readable message. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
  return value;
}

export const baseUrl = (process.env.COGNIPEER_BASE_URL ?? 'https://console.cognipeer.com').replace(/\/+$/, '');
