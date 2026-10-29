import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { paymentSchema, type User, type Payment } from '@sos/contracts';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { Database } from './database';
import { AuthService } from './auth';
import { hashToken } from './crypto';
import { demo } from './config';
import { paymentProvider, verifyFedaEvent, type VerifiedPayment } from './providers';
export const safePayment = (p: Payment): Payment => ({
  id: p.id,
  invoiceId: p.invoiceId,
  userId: p.userId,
  provider: p.provider,
  amount: p.amount,
  currency: p.currency,
  status: p.status,
  checkoutUrl: p.checkoutUrl,
  simulated: p.simulated,
  createdAt: p.createdAt,
});
export class PaymentService {
  constructor(
    readonly db: Database,
    readonly auth: AuthService,
  ) {}
  async list(u: User) {
    this.auth.require(u, ['client', 'admin', 'operator']);
    const list = await this.db
      .repo('payments')
      .find({ where: u.role === 'client' ? { userId: u.id } : {}, order: { createdAt: 'DESC' }, take: 100 });
    return list.map(safePayment);
  }
  async invoices(u: User) {
    this.auth.require(u, ['client', 'admin', 'operator']);
    return this.db.repo('invoices').find({
      where: u.role === 'client' ? { clientId: u.id } : {},
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }
  async start(u: User, invoiceId: string, key: string, body: unknown) {
    this.auth.require(u, ['client']);
    if (!/^[a-zA-Z0-9_-]{16,100}$/.test(key))
      throw new BadRequestException('Une clé d’idempotence est requise.');
    const v = paymentSchema.parse(body),
      provider = paymentProvider(v.provider),
      fingerprint = hashToken(JSON.stringify({ invoiceId, ...v }));
    let created = false;
    const reserved = await this.db.source.transaction(async (em) => {
      const invoice = await this.db
        .repo('invoices', em)
        .findOne({ where: { id: invoiceId, clientId: u.id }, lock: { mode: 'pessimistic_write' } });
      if (!invoice) throw new NotFoundException('Facture introuvable.');
      const previous = await this.db.repo('payments', em).findOneBy({ userId: u.id, idempotencyKey: key });
      if (previous) {
        if (previous.fingerprint !== fingerprint)
          throw new ConflictException('Cette clé désigne un autre paiement.');
        return previous;
      }
      if (invoice.status !== 'due') throw new ConflictException('Cette facture n’est plus à régler.');
      const care = await this.db.repo('cares', em).findOneByOrFail({ id: invoice.careId });
      if (care.status !== 'completed') throw new ConflictException('Les soins ne sont pas terminés.');
      const pending = await this.db.repo('payments', em).findOneBy({ invoiceId, status: 'pending' });
      if (pending) return pending;
      created = true;
      const p = await this.db.repo('payments', em).save({
        id: randomUUID(),
        invoiceId,
        userId: u.id,
        provider: v.provider,
        amount: invoice.amount,
        currency: 'XOF',
        status: 'pending',
        checkoutUrl: null,
        simulated: provider.simulated,
        idempotencyKey: key,
        fingerprint,
        externalId: null,
        expiresAt: new Date(Date.now() + 30 * 60000).toISOString(),
        phoneCipher: v.phone,
      });
      await this.auth.audit(u.id, 'payment.initiate', p.id, em);
      return p;
    });
    if (created) {
      try {
        const result = await provider.create(reserved, u, v.phone);
        await this.db.repo('payments').update({ id: reserved.id }, result);
        Object.assign(reserved, result);
      } catch {
        await this.auth.audit(u.id, 'payment.provider_uncertain', reserved.id);
        throw new ServiceUnavailableException(
          'Initialisation non confirmée. Ne relance pas un second paiement ; la coordination doit vérifier la référence ' +
            reserved.id +
            '.',
        );
      }
    }
    return safePayment(reserved);
  }
  async apply(id: string, result: VerifiedPayment, eventId: string) {
    return this.db.source.transaction(async (em) => {
      const p = await this.db
        .repo('payments', em)
        .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!p) throw new NotFoundException();
      if (p.externalId !== result.externalId || p.amount !== result.amount || p.currency !== result.currency)
        throw new BadRequestException('Le paiement ne correspond pas à la facture.');
      if (await this.db.repo('payment_events', em).findOneBy({ externalEventId: eventId }))
        return safePayment(p);
      if (p.status !== 'pending') {
        if (p.status !== result.status)
          throw new ConflictException('État final du paiement déjà enregistré.');
        return safePayment(p);
      }
      await this.db
        .repo('payment_events', em)
        .save({ paymentId: id, externalEventId: eventId, status: result.status });
      if (result.status !== 'pending') {
        const invoice = await this.db
          .repo('invoices', em)
          .findOne({ where: { id: p.invoiceId }, lock: { mode: 'pessimistic_write' } });
        if (!invoice || invoice.status !== 'due') throw new ConflictException('Facture déjà rapprochée.');
        await this.db.repo('payments', em).update({ id }, { status: result.status });
        if (result.status === 'succeeded')
          await this.db.repo('invoices', em).update({ id: p.invoiceId }, { status: 'paid' });
        await this.auth.audit(null, 'payment.' + result.status, id, em);
      }
      return safePayment({ ...p, status: result.status });
    });
  }
  async reconcile(u: User, id: string) {
    this.auth.require(u, ['client', 'operator', 'admin']);
    const p = await this.db
      .repo('payments')
      .findOneBy({ id, ...(u.role === 'client' ? { userId: u.id } : {}) });
    if (!p) throw new NotFoundException();
    if (p.status !== 'pending') return safePayment(p);
    if (!p.externalId)
      throw new ConflictException('Référence marchand non confirmée. Vérification manuelle requise.');
    if (p.simulated)
      throw new BadRequestException('Paiement fictif : utilise le bouton de simulation explicite.');
    const result = await paymentProvider(p.provider).verify(p.externalId);
    return this.apply(id, result, 'poll:' + p.externalId + ':' + result.status);
  }
  async webhook(raw: Buffer, signature: string) {
    const event = verifyFedaEvent(raw, signature),
      p = await this.db.repo('payments').findOneBy({ externalId: String(event.entity.id), simulated: false });
    if (!p) throw new NotFoundException();
    const result = await paymentProvider(p.provider).verify(p.externalId!);
    return this.apply(p.id, result, 'fedapay:' + event.id);
  }
  async simulate(u: User, id: string, body: unknown) {
    if (!demo || process.env.PAYMENT_MODE !== 'test') throw new NotFoundException();
    const { status } = z
      .object({ status: z.enum(['succeeded', 'failed', 'expired']), confirm: z.literal(true) })
      .strict()
      .parse(body);
    const p = await this.db
      .repo('payments')
      .findOneBy({ id, simulated: true, ...(u.role === 'client' ? { userId: u.id } : {}) });
    if (!p) throw new NotFoundException();
    this.auth.require(u, ['client', 'admin', 'operator']);
    if (!p.externalId) throw new ConflictException();
    return this.apply(
      id,
      { externalId: p.externalId, amount: p.amount, currency: p.currency, status },
      'test:' + id + ':' + status,
    );
  }
  async refund(u: User, id: string, body: unknown) {
    this.auth.require(u, ['admin']);
    const { reason } = z
      .object({ reason: z.string().min(5).max(500), confirm: z.literal(true) })
      .strict()
      .parse(body);
    return this.db.source.transaction(async (em) => {
      const p = await this.db
        .repo('payments', em)
        .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!p) throw new NotFoundException();
      const existing = await this.db.repo('refunds', em).findOneBy({ paymentId: id });
      if (existing) return existing;
      if (p.status !== 'succeeded') throw new ConflictException('Paiement non remboursable.');
      const status = p.simulated && demo ? 'completed' : 'manual_review';
      const r = await this.db
        .repo('refunds', em)
        .save({ paymentId: id, actorId: u.id, amount: p.amount, reason, status });
      if (status === 'completed') {
        await this.db.repo('payments', em).update({ id }, { status: 'refunded' });
        await this.db.repo('invoices', em).update({ id: p.invoiceId }, { status: 'refunded' });
      }
      await this.auth.audit(u.id, 'refund.' + status, r.id, em);
      return r;
    });
  }
}
