import { Client } from 'pg';
import { randomBytes } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function createTestDatabase() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const file = resolve(root, '.env');
  const env = existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {};
  const explicit = process.env.TEST_DATABASE_URL || env.TEST_DATABASE_URL;
  const source = explicit || process.env.DATABASE_URL || env.DATABASE_URL;
  if (!source) throw new Error('DATABASE_URL ou TEST_DATABASE_URL requis.');
  const url = new URL(source);
  if (process.env.NODE_ENV === 'production') throw new Error('Tests interdits en production.');
  if (explicit && !decodeURIComponent(url.pathname).endsWith('_test')) throw new Error('TEST_DATABASE_URL doit désigner une base au suffixe _test.');
  if (!explicit && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Pour un serveur distant, fournir explicitement TEST_DATABASE_URL.');
  const database = `sos_${randomBytes(8).toString('hex')}_test`;
  url.pathname = '/postgres';
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  try { await admin.query(`CREATE DATABASE "${database}"`); } catch (error) { await admin.end(); throw error; }
  url.pathname = '/' + database;
  return {
    url: url.toString(),
    async close() {
      try {
        // Only the unique database created above can be dropped by this helper.
        await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [database]);
        await admin.query(`DROP DATABASE "${database}"`);
      } finally { await admin.end(); }
    },
  };
}
