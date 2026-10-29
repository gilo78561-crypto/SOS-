import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...parseEnv(readFileSync(join(root, '.env'), 'utf8')), ...process.env };
const url = new URL(env.DATABASE_URL);
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || env.NODE_ENV === 'production')
  throw new Error('Initialisation réservée à une base locale de développement.');
const data = join(root, '.data/postgres');
if (existsSync(join(data, 'PG_VERSION'))) throw new Error('Cluster existant conservé. Utiliser postgres-local.ps1.');
const pgBin = [env.PG_BIN, join(root, '.cache/postgresql/pgsql/bin'), 'D:/PostgreSQL/16/bin', 'D:/PostgreSQL/bin', 'C:/Program Files/PostgreSQL/16/bin'].find((p) => p && existsSync(join(p, 'initdb.exe')));
if (!pgBin) throw new Error('Définir PG_BIN vers les binaires PostgreSQL 16.');
mkdirSync(join(root, '.data'), { recursive: true });
const passwordFile = join(root, '.data/init-password.tmp');
writeFileSync(passwordFile, decodeURIComponent(url.password), { mode: 0o600, flag: 'wx' });
function run(name, args) {
  const p = spawnSync(join(pgBin, name + '.exe'), args, { stdio: 'inherit', windowsHide: true });
  if (p.error || p.status !== 0) throw new Error(`${name} a échoué.`);
}
try {
  run('initdb', ['-D', data, '-U', decodeURIComponent(url.username), '--pwfile=' + passwordFile, '--auth=scram-sha-256', '--encoding=UTF8', '--locale=C']);
} finally { unlinkSync(passwordFile); }
run('pg_ctl', ['-D', data, '-l', join(root, '.data/postgres.log'), '-o', `-p ${url.port || '55432'} -h 127.0.0.1`, '-w', 'start']);
const { Client } = await import('pg');
const database = decodeURIComponent(url.pathname.slice(1));
if (!/^[a-zA-Z0-9_]+$/.test(database)) throw new Error('Nom de base invalide.');
url.pathname = '/postgres';
const client = new Client({ connectionString: url.toString() });
await client.connect();
try { await client.query(`CREATE DATABASE "${database}"`); } finally { await client.end(); }
console.log('Base locale créée. Exécuter npm run db:seed.');
