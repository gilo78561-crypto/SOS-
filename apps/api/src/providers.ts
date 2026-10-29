import { ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { Payment, User } from '@sos/contracts';
import { demo, origin, production } from './config';
export interface ProviderResult {
  externalId: string;
  checkoutUrl: string | null;
}
export interface VerifiedPayment {
  externalId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'expired';
}
export interface PaymentProvider {
  readonly name: string;
  readonly simulated: boolean;
  create(payment: Payment, user: User, phone: string): Promise<ProviderResult>;
  verify(externalId: string): Promise<VerifiedPayment>;
}
export class TestPaymentProvider implements PaymentProvider {
  readonly name = 'test';
  readonly simulated = true;
  async create(payment: Payment) {
    if (!demo || production) throw new ServiceUnavailableException();
    return { externalId: 'test-' + payment.id, checkoutUrl: null };
  }
  async verify(_id: string): Promise<VerifiedPayment> {
    throw new ServiceUnavailableException('Résultat fictif à déclencher explicitement dans la démo.');
  }
}
const transactionSchema = z.object({
  id: z.union([z.number(), z.string()]),
  amount: z.number(),
  status: z.string(),
  currency: z.object({ iso: z.string() }),
});
export class FedaPayProvider implements PaymentProvider {
  readonly simulated = false;
  constructor(readonly name: 'mtn' | 'moov' | 'celtiis') {}
  private get base() {
    return process.env.FEDAPAY_ENVIRONMENT === 'live'
      ? 'https://api.fedapay.com/v1'
      : 'https://sandbox-api.fedapay.com/v1';
  }
  private async request(path: string, method = 'GET', body?: unknown) {
    if (!process.env.FEDAPAY_SECRET_KEY)
      throw new ServiceUnavailableException('Compte marchand FedaPay non configuré.');
    if (production && process.env.FEDAPAY_ENVIRONMENT !== 'live')
      throw new ServiceUnavailableException('Environnement marchand de production requis.');
    const r = await fetch(this.base + path, {
      method,
      headers: {
        Authorization: 'Bearer ' + process.env.FEDAPAY_SECRET_KEY,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok)
      throw new ServiceUnavailableException('Le prestataire de paiement est temporairement indisponible.');
    return (await r.json()) as Record<string, unknown>;
  }
  async create(payment: Payment, user: User, phone: string) {
    const data = await this.request('/transactions', 'POST', {
      description: 'SOS DOCTEURS — facture ' + payment.invoiceId,
      amount: payment.amount,
      currency: { iso: 'XOF' },
      callback_url: origin + '/espace?tab=payments',
      customer: {
        firstname: user.name,
        lastname: '',
        email: user.email,
        phone_number: { number: phone, country: 'bj' },
      },
      custom_metadata: { payment_id: payment.id, operator: this.name },
    });
    const transaction = transactionSchema.parse(data['v1/transaction']);
    const token = await this.request('/transactions/' + transaction.id + '/token', 'POST');
    const checkout = z.object({ url: z.url() }).parse(token);
    if (!new URL(checkout.url).hostname.endsWith('.fedapay.com'))
      throw new BadRequestException('URL du prestataire non reconnue.');
    return { externalId: String(transaction.id), checkoutUrl: checkout.url };
  }
  async verify(externalId: string) {
    const data = await this.request('/transactions/' + encodeURIComponent(externalId));
    const t = transactionSchema.parse(data['v1/transaction']);
    const status: VerifiedPayment['status'] =
      t.status === 'approved'
        ? 'succeeded'
        : ['declined', 'canceled'].includes(t.status)
          ? 'failed'
          : t.status === 'expired'
            ? 'expired'
            : 'pending';
    return { externalId: String(t.id), amount: t.amount, currency: t.currency.iso, status };
  }
}
export class MtnPaymentAdapter extends FedaPayProvider {
  constructor() {
    super('mtn');
  }
}
export class MoovPaymentAdapter extends FedaPayProvider {
  constructor() {
    super('moov');
  }
}
export class CeltiisPaymentAdapter extends FedaPayProvider {
  constructor() {
    super('celtiis');
  }
}
export function paymentProvider(name: string): PaymentProvider {
  if (process.env.PAYMENT_MODE === 'test' && demo) return new TestPaymentProvider();
  if (process.env.PAYMENT_MODE !== 'fedapay')
    throw new ServiceUnavailableException(
      'Les paiements ne sont pas encore connectés. Contacte la coordination.',
    );
  const adapters = {
    mtn: new MtnPaymentAdapter(),
    moov: new MoovPaymentAdapter(),
    celtiis: new CeltiisPaymentAdapter(),
  };
  if (!(name in adapters)) throw new BadRequestException('Opérateur inconnu.');
  return adapters[name as keyof typeof adapters];
}
export function verifyFedaEvent(raw: Buffer, signature: string) {
  if (!process.env.FEDAPAY_WEBHOOK_SECRET) throw new ServiceUnavailableException('Webhook non configuré.');
  try {
    const parts = signature.split(',').map((v) => v.trim().split('='));
    const timestamp = Number(parts.find((p) => p[0] === 't')?.[1]);
    if (!Number.isSafeInteger(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300)
      throw new Error('Invalid timestamp');
    const expected = createHmac('sha256', process.env.FEDAPAY_WEBHOOK_SECRET)
      .update(timestamp + '.' + raw.toString('utf8'))
      .digest();
    const signatures = parts
      .filter((p) => p[0] === 's' && /^[a-f0-9]{64}$/i.test(p[1] ?? ''))
      .map((p) => Buffer.from(p[1], 'hex'));
    if (!signatures.some((value) => value.length === expected.length && timingSafeEqual(value, expected)))
      throw new Error('Invalid signature');
    return z
      .object({
        id: z.union([z.string(), z.number()]),
        entity: z.object({ id: z.union([z.string(), z.number()]) }),
      })
      .parse(JSON.parse(raw.toString('utf8')));
  } catch {
    throw new BadRequestException('Signature ou événement invalide.');
  }
}
