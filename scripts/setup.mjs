import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { parseEnv } from 'node:util';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = resolve(root, '.env');
mkdirSync(resolve(root, '.data'), { recursive: true });
if (!existsSync(file)) {
  const password = randomBytes(24).toString('hex');
  const values = parseEnv(readFileSync(resolve(root, '.env.example'), 'utf8'));
  Object.assign(values, {
    DATABASE_URL: `postgresql://sos:${password}@127.0.0.1:55432/sos_docteurs`,
    DATA_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
    DEMO_MODE: 'true', DEMO_PASSWORD: 'Demo-SOS-2026!', PAYMENT_MODE: 'test',
    EXPO_PUBLIC_DEMO_MODE: 'true', NEXT_PUBLIC_API_URL: '/api',
    API_INTERNAL_URL: 'http://127.0.0.1:4000', POSTGRES_PASSWORD: password,
  });
  writeFileSync(file, Object.entries(values).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600, flag: 'wx' });
  console.log('Configuration locale créée. Secrets non affichés.');
} else console.log('.env existant conservé, y compris sa clé de chiffrement.');
const env = parseEnv(readFileSync(file, 'utf8'));
for (const [workspace, keys] of [
  ['web', ['NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_MAP_PROVIDER', 'NEXT_PUBLIC_MAP_TILE_URL', 'NEXT_PUBLIC_MAP_ATTRIBUTION', 'NEXT_PUBLIC_MAP_ATTRIBUTION_URL', 'API_INTERNAL_URL']],
  ['mobile', ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_DEMO_MODE', 'EXPO_PUBLIC_WEB_URL']],
]) {
  const target = resolve(root, 'apps', workspace, '.env.local');
  if (existsSync(target)) { console.log(`apps/${workspace}/.env.local conservé.`); continue; }
  writeFileSync(target, keys.filter((k) => env[k] !== undefined).map((k) => `${k}=${env[k]}`).join('\n') + '\n', { mode: 0o600, flag: 'wx' });
  console.log(`apps/${workspace}/.env.local créé avec les seules variables nécessaires.`);
}
console.log('Démarrer PostgreSQL, puis exécuter npm run db:seed et npm run dev.');
