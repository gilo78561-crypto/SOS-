import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createHmac, randomBytes } from 'node:crypto';
import { createTestDatabase } from '../scripts/test-database.mjs';
import type { Database } from '../apps/api/src/database';
import type { createApp } from '../apps/api/src/app';
import type handleApi from '../apps/api/src/serverless';

let isolated: Awaited<ReturnType<typeof createTestDatabase>>;
const databases: Database[] = [];
let application: Awaited<ReturnType<typeof createApp>>;
let handler: typeof handleApi;
let connections = 0;
const origin = 'http://localhost:3000';
const account = {
  name: 'Test adaptateur',
  email: 'adapter@example.test',
  password: 'Adapter-Test-2026!',
  phone: '+2290190000000',
  role: 'client',
  consent: true,
};

beforeAll(async () => {
  isolated = await createTestDatabase();
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('DATA_ENCRYPTION_KEY', randomBytes(32).toString('hex'));
  vi.stubEnv('WEB_ORIGIN', origin);
  vi.stubEnv('DATABASE_URL', '');
  const databaseModule = await import('../apps/api/src/database');
  const connect = databaseModule.Database.prototype.connect;
  vi.spyOn(databaseModule.Database.prototype, 'connect').mockImplementation(function (
    this: Database,
    migrate,
  ) {
    databases.push(this);
    connections++;
    return connect.call(this, migrate);
  });
  const appModule = await import('../apps/api/src/app');
  const factory = appModule.createApp;
  vi.spyOn(appModule, 'createApp').mockImplementation(async (...args) => {
    application = await factory(...args);
    return application;
  });
  handler = (await import('../apps/api/src/serverless')).default;
});

afterAll(async () => {
  if (application) await application.app.close();
  for (const db of databases) await db.close();
  if (isolated) await isolated.close();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('Adaptateur HTTP utilisé par Next.js', () => {
  it('annonce une indisponibilité sans divulguer la configuration', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await request(handler).get('/api/health');
      expect(response.status).toBe(503);
      expect(response.body.code).toBe('API_UNAVAILABLE');
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['retry-after']).toBe('30');
      expect(JSON.stringify(response.body)).not.toContain('DATABASE_URL');
    } finally {
      log.mockRestore();
    }
  });

  it('reprend après correction et partage une seule initialisation entre requêtes', async () => {
    vi.stubEnv('DATABASE_URL', isolated.url);
    const before = connections;
    const results = await Promise.all(Array.from({ length: 4 }, () => request(handler).get('/api/health')));
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200]);
    expect(results[0].body).toEqual({ ok: true, service: 'sos-docteurs-api' });
    expect(connections - before).toBe(1);
  });

  it('transmet le JSON, les cookies et les contrôles CSRF au serveur Nest', async () => {
    const registered = await request(handler).post('/api/auth/register').set('Origin', origin).send(account);
    expect(registered.status).toBe(201);
    const cookie = registered.headers['set-cookie'][0].split(';')[0];
    expect(registered.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(registered.headers['set-cookie'][0]).toContain('Path=/api');
    const body = { name: 'Proche fictif', relationship: 'Parent', consent: true };
    expect(
      (
        await request(handler)
          .post('/api/beneficiaries')
          .set('Origin', origin)
          .set('Cookie', cookie)
          .send(body)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(handler)
          .post('/api/beneficiaries')
          .set('Origin', origin)
          .set('Cookie', cookie)
          .set('X-CSRF-Token', registered.body.csrf)
          .send(body)
      ).status,
    ).toBe(201);
    expect((await request(handler).get('/api/cares')).status).toBe(401);
  });

  it('conserve les octets du webhook nécessaires à la vérification de signature', async () => {
    const secret = 'local-webhook-test-only';
    vi.stubEnv('FEDAPAY_WEBHOOK_SECRET', secret);
    const raw = '{ "id": "adapter-test",\n  "entity": { "id": "missing-payment" } }';
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', secret)
      .update(timestamp + '.' + raw)
      .digest('hex');
    const send = (body: string) =>
      request(handler)
        .post('/api/webhooks/fedapay')
        .set('Content-Type', 'application/json')
        .set('x-fedapay-signature', `t=${timestamp},s=${signature}`)
        .send(body);
    // A valid signature reaches the lookup; this fictitious payment does not exist.
    expect((await send(raw)).status).toBe(404);
    expect((await send(JSON.stringify(JSON.parse(raw)))).status).toBe(400);
  });

  it('refuse un stockage éphémère de documents sur Vercel', async () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('STORAGE_BUCKET', '');
    try {
      const { PrivateStorage } = await import('../apps/api/src/extras');
      await expect(new PrivateStorage().put(Buffer.from('Document fictif'))).rejects.toThrow(
        'stockage privé',
      );
    } finally {
      vi.stubEnv('VERCEL', '');
    }
  });
});
