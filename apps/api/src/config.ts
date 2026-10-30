import { config } from 'dotenv';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
export const root =
  [process.cwd(), resolve(process.cwd(), '../..')].find((p) => existsSync(resolve(p, '.env.example'))) ??
  process.cwd();
config({ path: resolve(root, '.env'), quiet: true });

function firstNonEmpty(...values: Array<string | undefined>) {
  return values.find((value) => value?.trim())?.trim();
}

export function resolveDatabaseUrls(env: NodeJS.ProcessEnv = process.env) {
  const databaseUrl = firstNonEmpty(
    env.DATABASE_URL,
    env.SoS_BG_DATABASE_URL,
    env.POSTGRES_URL,
    env.SoS_BG_POSTGRES_URL,
  );
  const databaseUrlUnpooled = firstNonEmpty(
    env.DATABASE_URL_UNPOOLED,
    env.SoS_BG_DATABASE_URL_UNPOOLED,
    env.POSTGRES_URL_NON_POOLING,
    env.SoS_BG_POSTGRES_URL_NON_POOLING,
    databaseUrl,
  );
  return { databaseUrl, databaseUrlUnpooled };
}

export const { databaseUrl, databaseUrlUnpooled } = resolveDatabaseUrls();
export const production = process.env.NODE_ENV === 'production';
export const demo = !production && process.env.DEMO_MODE === 'true';
const deploymentHost =
  process.env.VERCEL_ENV === 'preview'
    ? process.env.VERCEL_URL
    : process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
export const origin = (
  process.env.WEB_ORIGIN || (deploymentHost ? `https://${deploymentHost}` : 'http://localhost:3000')
).replace(/\/+$/, '');
const publicApiUrl = process.env.PUBLIC_API_URL || origin;
export function validateConfig() {
  if (!databaseUrl) throw new Error('DATABASE_URL obligatoire. Exécuter npm run setup.');
  if (!/^[a-f0-9]{64}$/i.test(process.env.DATA_ENCRYPTION_KEY ?? ''))
    throw new Error('DATA_ENCRYPTION_KEY : 32 octets hexadécimaux requis.');
  if (production && (process.env.DEMO_MODE === 'true' || process.env.PAYMENT_MODE === 'test'))
    throw new Error('Démo et faux paiements interdits en production.');
  if (production && (!origin.startsWith('https://') || !publicApiUrl.startsWith('https://')))
    throw new Error('HTTPS obligatoire en production.');
}
