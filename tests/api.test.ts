import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomBytes, randomUUID } from 'node:crypto';
import type { User, Care, Professional } from '@sos/contracts';
import type { Database } from '../apps/api/src/database';
import type { createApp } from '../apps/api/src/app';
import { createTestDatabase } from '../scripts/test-database.mjs';

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let db: Database;
let application: Awaited<ReturnType<typeof createApp>>;
const accounts: Record<string, { user: User; token: string }> = {};
let serviceId: string;
let professional: Professional;
const password = 'Integration-Test-2026!';
const origin = 'http://localhost:3000';
const start = new Date(Date.now() + 2 * 86400000).toISOString();
const end = new Date(Date.now() + 3 * 86400000).toISOString();
const call = () => request(application.app.getHttpServer());
const bearer = (name: string) => 'Bearer ' + accounts[name].token;
const careBody = () => ({ serviceId, description: 'Intervention exclusivement fictive', address: 'Adresse fictive de test', zone: 'Cotonou', startAt: start, consent: true });

beforeAll(async () => {
  database = await createTestDatabase();
  Object.assign(process.env, {
    NODE_ENV: 'test', DATABASE_URL: database.url, DEMO_MODE: 'true', PAYMENT_MODE: 'test',
    DATA_ENCRYPTION_KEY: randomBytes(32).toString('hex'), WEB_ORIGIN: origin,
  });
  const { Database: DatabaseClass } = await import('../apps/api/src/database');
  const { createApp: factory } = await import('../apps/api/src/app');
  db = await new DatabaseClass(database.url).connect(true);
  application = await factory(db);
  for (const [name, role] of [['patient', 'client'], ['other', 'client'], ['doctor', 'doctor'], ['operator', 'client'], ['admin', 'client']] as const) {
    const result = await application.auth.register({ name: 'Test ' + name, email: name + '@integration.test', password, phone: '+2290190000000', role, consent: true });
    if (name === 'admin' || name === 'operator') {
      await db.repo('users').update({ id: result.user.id }, { role: name });
      result.user.role = name;
    }
    accounts[name] = result;
  }
  await db.repo('zones').save({ name: 'Cotonou', active: true });
  const service = await db.repo('services').save({ name: 'Service fictif', description: 'Service uniquement pour les tests', category: 'home', skills: ['consultation'], durationMinutes: 60, price: null, active: true });
  serviceId = service.id;
  professional = await application.care.profile(accounts.doctor.user);
  await db.repo('professionals').update({ id: professional.id }, { verification: 'approved', specialty: 'Médecine fictive', skills: ['consultation'], zones: ['Cotonou'] });
  await application.care.addAvailability(accounts.doctor.user, { startAt: start, endAt: end, available: true });
}, 60000);
afterAll(async () => {
  if (application) await application.app.close();
  if (db) await db.close();
  if (database) await database.close();
});

describe('API avec PostgreSQL isolé', () => {
  it('refuse une requête privée sans session', async () => {
    expect((await call().get('/api/cares')).status).toBe(401);
  });
  it('interdit les inscriptions privilégiées', async () => {
    const r = await call().post('/api/auth/register').send({ name: 'Intrus fictif', email: 'intrus@integration.test', password, phone: '+2290190000000', role: 'admin', consent: true });
    expect(r.status).toBe(400);
  });
  it('protège les mutations par cookie avec origine et jeton CSRF', async () => {
    const login = await call().post('/api/auth/login').send({ email: 'patient@integration.test', password });
    expect(login.status).toBe(201);
    const cookie = login.headers['set-cookie'][0].split(';')[0];
    const body = { name: 'Proche fictif', relationship: 'Parent', consent: true };
    expect((await call().post('/api/beneficiaries').set('Cookie', cookie).set('Origin', origin).send(body)).status).toBe(403);
    expect((await call().post('/api/beneficiaries').set('Cookie', cookie).set('Origin', origin).set('X-CSRF-Token', login.body.csrf).send(body)).status).toBe(201);
    expect((await call().post('/api/beneficiaries').set('Cookie', cookie).set('Origin', 'https://untrusted.example').set('X-CSRF-Token', login.body.csrf).send(body)).status).toBe(403);
  });
  it('isole les demandes et les bénéficiaires entre patients', async () => {
    const created = await call().post('/api/cares').set('Authorization', bearer('patient')).send(careBody());
    expect(created.status).toBe(201);
    expect((await call().get('/api/cares/' + created.body.id).set('Authorization', bearer('other'))).status).toBe(404);
    const beneficiary = await application.care.addBeneficiary(accounts.other.user, { name: 'Autre proche fictif', relationship: 'Parent', consent: true });
    expect((await call().post('/api/cares').set('Authorization', bearer('patient')).send({ ...careBody(), beneficiaryId: beneficiary.id })).status).toBe(403);
  });
  it('réalise le parcours affectation, soins, facture et paiement idempotent', async () => {
    const created = await call().post('/api/cares').set('Authorization', bearer('patient')).send(careBody());
    expect(created.status).toBe(201);
    const care = created.body as Care;
    const path = '/api/cares/' + care.id;
    expect((await call().post(path + '/transition').set('Authorization', bearer('patient')).send({ status: 'completed' })).status).toBe(409);
    expect((await call().post(path + '/quote').set('Authorization', bearer('operator')).send({ amount: 15000, confirm: true })).status).toBe(201);
    expect((await call().post(path + '/transition').set('Authorization', bearer('operator')).send({ status: 'searching' })).status).toBe(201);
    const candidates = await call().get(path + '/candidates').set('Authorization', bearer('operator'));
    expect(candidates.body.some((p: { id: string }) => p.id === professional.id)).toBe(true);
    expect((await call().post(path + '/assign').set('Authorization', bearer('operator')).send({ professionalId: professional.id })).status).toBe(201);
    for (const status of ['accepted', 'en_route', 'arrived', 'in_progress'])
      expect((await call().post(path + '/transition').set('Authorization', bearer('doctor')).send({ status })).status).toBe(201);
    expect((await call().post(path + '/notes').set('Authorization', bearer('doctor')).send({ content: 'Note clinique strictement fictive.' })).status).toBe(201);
    expect((await call().get(path + '/notes').set('Authorization', bearer('admin'))).status).toBe(403);
    expect((await call().get(path + '/notes').set('Authorization', bearer('patient'))).body).toHaveLength(1);
    expect((await call().post(path + '/transition').set('Authorization', bearer('doctor')).send({ status: 'completed' })).status).toBe(201);
    expect((await call().post(path + '/transition').set('Authorization', bearer('doctor')).send({ status: 'completed' })).status).toBe(409);
    const invoices = await db.repo('invoices').findBy({ careId: care.id });
    expect(invoices).toHaveLength(1);
    const paymentPath = '/api/invoices/' + invoices[0].id + '/pay';
    const key = randomUUID(), body = { provider: 'mtn', phone: '+2290190000000' };
    const first = await call().post(paymentPath).set('Authorization', bearer('patient')).set('Idempotency-Key', key).send(body);
    const second = await call().post(paymentPath).set('Authorization', bearer('patient')).set('Idempotency-Key', key).send(body);
    expect(first.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
    expect((await call().post('/api/payments/' + first.body.id + '/simulate').set('Authorization', bearer('other')).send({ status: 'succeeded', confirm: true })).status).toBe(404);
    expect((await call().post('/api/payments/' + first.body.id + '/simulate').set('Authorization', bearer('patient')).send({ status: 'succeeded', confirm: true })).status).toBe(201);
    expect((await db.repo('invoices').findOneByOrFail({ id: invoices[0].id })).status).toBe('paid');
    expect((await call().post('/api/payments/' + first.body.id + '/refund').set('Authorization', bearer('admin')).send({ reason: 'Remboursement de test uniquement', confirm: true })).status).toBe(201);
  });
  it('empêche deux affectations simultanées sur le même créneau', async () => {
    const cares = await Promise.all([1, 2].map(() => application.care.create(accounts.patient.user, careBody())));
    for (const c of cares) await application.care.transition(accounts.operator.user, c.id, { status: 'searching' });
    const results = await Promise.all(cares.map((c) => call().post('/api/cares/' + c.id + '/assign').set('Authorization', bearer('operator')).send({ professionalId: professional.id })));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const winner = cares[results.findIndex((r) => r.status === 201)];
    await application.care.transition(accounts.doctor.user, winner.id, { status: 'searching' });
    expect((await call().get('/api/cares/' + winner.id).set('Authorization', bearer('doctor'))).status).toBe(404);
  });
  it('révoque l’accès dès la suspension d’un compte', async () => {
    await application.auth.suspend(accounts.admin.user, accounts.other.user.id, { suspended: true, reason: 'Suspension fictive de test', confirm: true });
    expect((await call().get('/api/auth/me').set('Authorization', bearer('other'))).status).toBe(401);
  });
  it('ignore les faux webhooks de paiement', async () => {
    process.env.FEDAPAY_WEBHOOK_SECRET = 'test-webhook-secret';
    expect((await call().post('/api/webhooks/fedapay').set('x-fedapay-signature', 'invalid').send({ id: 1, entity: { id: 1 } })).status).toBe(400);
  });
});
