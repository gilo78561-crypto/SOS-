import { BadRequestException, ConflictException } from '@nestjs/common';
import { z } from 'zod';
import type { User } from '@sos/contracts';
import { Database } from './database';
import { AuthService } from './auth';
import { CareService } from './care';
export class OperationsService {
  constructor(
    readonly db: Database,
    readonly auth: AuthService,
    readonly care: CareService,
  ) {}
  async settings(u: User) {
    this.auth.require(u, ['admin', 'operator']);
    const rows = await this.db.repo('settings').find();
    const defaults = { assignmentResponseMinutes: '30', retentionReviewDays: '365' };
    return { ...defaults, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) };
  }
  async updateSettings(u: User, body: unknown) {
    this.auth.require(u, ['admin']);
    const v = z
      .object({
        assignmentResponseMinutes: z.number().int().min(5).max(240),
        retentionReviewDays: z.number().int().min(30).max(3650),
        confirm: z.literal(true),
      })
      .strict()
      .parse(body);
    return this.db.source.transaction(async (em) => {
      for (const key of ['assignmentResponseMinutes', 'retentionReviewDays'] as const)
        await this.db.repo('settings', em).upsert({ key, value: String(v[key]) }, ['key']);
      await this.auth.audit(u.id, 'settings.update', null, em);
      return { ok: true };
    });
  }
  async releaseExpired(u: User) {
    this.auth.require(u, ['admin', 'operator']);
    const settings = await this.settings(u);
    const cutoff = new Date(Date.now() - Number(settings.assignmentResponseMinutes) * 60000).toISOString();
    const rows = await this.db
      .repo('assignments')
      .createQueryBuilder('a')
      .where('a.active=true AND a."createdAt"<:cutoff', { cutoff })
      .take(100)
      .getMany();
    let released = 0;
    for (const assignment of rows)
      await this.db.source.transaction(async (em) => {
        const c = await this.care.access(u, assignment.careId, em, true);
        if (c.status !== 'assigned' || c.professionalId !== assignment.professionalId) return;
        if (!(await this.db.repo('assignments', em).findOneBy({ id: assignment.id, active: true }))) return;
        await this.db.repo('assignments', em).update({ id: assignment.id, active: true }, { active: false });
        await this.db
          .repo('cares', em)
          .update({ id: c.id }, { status: 'searching', professionalId: null, professionalName: null });
        await this.care.event(
          u,
          c,
          'searching',
          'La proposition n’a pas reçu de réponse dans le délai configuré. Recherche relancée.',
          em,
        );
        released++;
      });
    await this.auth.audit(u.id, 'assignments.release_expired');
    return { released };
  }
  async weekly(u: User, body: unknown) {
    const v = z
      .object({
        weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
        start: z.string().regex(/^\d{2}:\d{2}$/),
        end: z.string().regex(/^\d{2}:\d{2}$/),
        weeks: z.number().int().min(1).max(4),
      })
      .strict()
      .parse(body);
    if (
      v.start >= v.end ||
      v.end > '23:59' ||
      v.start > '23:59' ||
      Number(v.start.slice(3)) > 59 ||
      Number(v.end.slice(3)) > 59
    )
      throw new BadRequestException('Horaires invalides.');
    const p = await this.care.profile(u);
    let created = 0;
    const now = new Date(),
      startDate = new Date(now.getTime() + 3600000).toISOString().slice(0, 10);
    for (let day = 0; day < v.weeks * 7; day++) {
      const d = new Date(startDate + 'T12:00:00+01:00');
      d.setUTCDate(d.getUTCDate() + day);
      if (!v.weekdays.includes(d.getUTCDay())) continue;
      const date = d.toISOString().slice(0, 10),
        startAt = new Date(date + 'T' + v.start + ':00+01:00').toISOString(),
        endAt = new Date(date + 'T' + v.end + ':00+01:00').toISOString();
      if (new Date(startAt) < now) continue;
      if (
        !(await this.db
          .repo('availabilities')
          .findOneBy({ professionalId: p.id, startAt, endAt, available: true }))
      ) {
        await this.care.addAvailability(u, { startAt, endAt, available: true });
        created++;
      }
    }
    await this.auth.audit(u.id, 'availability.weekly', p.id);
    return { created };
  }
  async earnings(u: User) {
    this.auth.require(u, ['doctor', 'nurse']);
    const p = await this.care.profile(u);
    const cares = await this.db
      .repo('cares')
      .find({ where: { professionalId: p.id, status: 'completed' }, order: { startAt: 'DESC' }, take: 200 });
    const items = await Promise.all(
      cares.map(async (c) => {
        const i = await this.db.repo('invoices').findOneBy({ careId: c.id });
        return {
          careId: c.id,
          serviceName: c.serviceName,
          startAt: c.startAt,
          invoicedAmount: i?.amount ?? null,
          invoiceStatus: i?.status ?? null,
        };
      }),
    );
    return {
      items,
      totalInvoiced: items.reduce((n, i) => n + (i.invoicedAmount ?? 0), 0),
      currency: 'XOF',
      notice:
        'Montants facturés pour vos missions, avant toute répartition contractuelle. Ce total ne constitue pas votre rémunération ni une preuve de virement.',
    };
  }
  async exportPersonal(u: User) {
    const requests =
      u.role === 'client' ? await this.db.repo('cares').find({ where: { clientId: u.id }, take: 1000 }) : [];
    await this.auth.audit(u.id, 'privacy.export', u.id);
    return {
      account: { name: u.name, email: u.email, phone: u.phone },
      beneficiaries:
        u.role === 'client'
          ? await this.db.repo('beneficiaries').find({ where: { ownerId: u.id }, take: 1000 })
          : [],
      requests,
      consents: await this.db.repo('consents').find({ where: { userId: u.id }, take: 1000 }),
      generatedAt: new Date().toISOString(),
      notice:
        'Export personnel limité aux données gérées par votre compte. Pour les autres droits, contactez le support.',
    };
  }
  async createService(u: User, body: unknown) {
    this.auth.require(u, ['admin']);
    const v = z
      .object({
        name: z.string().min(2).max(100),
        description: z.string().min(5).max(1000),
        category: z.string().min(2).max(50),
        skills: z.array(z.string().min(2).max(50)).min(1).max(15),
        durationMinutes: z.number().int().min(15).max(480),
        price: z.number().int().min(0).max(10000000).nullable(),
        confirm: z.literal(true),
      })
      .strict()
      .parse(body);
    if (await this.db.repo('services').findOneBy({ name: v.name }))
      throw new ConflictException('Un service porte déjà ce nom.');
    const { confirm: _confirm, ...data } = v;
    const service = await this.db.repo('services').save({ ...data, active: true });
    await this.auth.audit(u.id, 'service.create', service.id);
    return service;
  }
}
