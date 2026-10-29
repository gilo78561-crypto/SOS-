import { config } from 'dotenv';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
export const root =
  [process.cwd(), resolve(process.cwd(), '../..')].find((p) => existsSync(resolve(p, '.env.example'))) ??
  process.cwd();
config({ path: resolve(root, '.env'), quiet: true });
export const production = process.env.NODE_ENV === 'production';
export const demo = !production && process.env.DEMO_MODE === 'true';
export const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
export function validateConfig() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL obligatoire. Exécuter npm run setup.');
  if (!/^[a-f0-9]{64}$/i.test(process.env.DATA_ENCRYPTION_KEY ?? ''))
    throw new Error('DATA_ENCRYPTION_KEY : 32 octets hexadécimaux requis.');
  if (production && (process.env.DEMO_MODE === 'true' || process.env.PAYMENT_MODE === 'test'))
    throw new Error('Démo et faux paiements interdits en production.');
  if (production && (!origin.startsWith('https://') || !process.env.PUBLIC_API_URL?.startsWith('https://')))
    throw new Error('HTTPS obligatoire en production.');
}
