import OpenAI from 'openai';

export function need(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env var ${name}. Copy .env.example to .env and run with node --env-file=.env.`);
    process.exit(1);
  }
  return v;
}

export const baseUrl = `${need('CONSOLE_BASE_URL').replace(/\/+$/, '')}/api/client/v1`;
export const apiToken = need('CONSOLE_API_TOKEN');
export const client = new OpenAI({ baseURL: baseUrl, apiKey: apiToken });
