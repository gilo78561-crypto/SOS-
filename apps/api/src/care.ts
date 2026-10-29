import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  beneficiarySchema,
  careSchema,
  transitions,
  transitionSchema,
  availabilitySchema,
  professionalSchema,
  type User,
  type Care,
  type CareStatus,
} from '@sos/contracts';
import { z } from 'zod';
import { LessThan, MoreThan, type EntityManager } from 'typeorm';
import { Database } from './database';
import { AuthService } from './auth';
const terminal: CareStatus[] = ['completed', 'cancelled', 'failed'];
export class CareService {
  constructor(
    readonly db: Database,
    readonly auth: AuthService,
  ) {}
  async services() {
    return this.db.repo('services').find({ where: { active: true }, order: { name: 'ASC' } });
  }
  async beneficiaries(u: User) {
    this.auth.require(u, ['client']);
    return this.db.repo('beneficiaries').find({ where: { ownerId: u.id }, take: 100 });
  }
  async addBeneficiary(u: User, body: unknown) {
    this.auth.require(u, ['client']);
    const v = beneficiarySchema.parse(body);
    return this.db.source.transaction(async (em) => {
      const b = await this.db
        .repo('beneficiaries', em)
        .save({ ...v, birthDate: v.birthDate ?? null, ownerId: u.id });
      await this.db
        .repo('consents', em)
        .save({ userId: u.id, purpose: 'beneficiary-management', resourceId: b.id, version: '2026-10-v1' });
      return b;
    });
  }
  async profile(u: User) {
    this.auth.require(u, ['doctor', 'nurse']);
    return this.db.repo('professionals').findOneByOrFail({ userId: u.id });
  }
  async updateProfile(u: User, body: unknown) {
    const p = await this.profile(u),
      v = professionalSchema.parse(body);
    return this.db.source.transaction(async (em) => {
      await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['pro:' + p.id]);
      await this.db
        .repo('professionals', em)
        .update(
          { id: p.id },
          { ...v, verification: 'pending', reason: 'Profil modifié : nouvelle vérification requise.' },
        );
      await this.auth.audit(u.id, 'professional.profile_update', p.id, em);
      return this.db.repo('professionals', em).findOneByOrFail({ id: p.id });
    });
  }
  async availability(u: User) {
    const p = await this.profile(u);
    return this.db
      .repo('availabilities')
      .find({ where: { professionalId: p.id }, order: { startAt: 'DESC' }, take: 100 });
  }
  async addAvailability(u: User, body: unknown) {
    const p = await this.profile(u),
      v = availabilitySchema.parse(body);
    if (new Date(v.endAt).getTime() - new Date(v.startAt).getTime() > 31 * 86400000)
      throw new BadRequestException('Période maximale : 31 jours.');
    return this.db.source.transaction(async (em) => {
      await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['pro:' + p.id]);
      if (!v.available) {
        const count = await this.db
          .repo('cares', em)
          .createQueryBuilder('c')
          .where('c."professionalId"=:id', { id: p.id })
          .andWhere('c.status NOT IN (:...statuses)', { statuses: terminal })
          .andWhere('c."startAt"<:end AND c."endAt">:start', { start: v.startAt, end: v.endAt })
          .getCount();
        if (count)
          throw new ConflictException(
            'Une mission est déjà prévue sur ce créneau. Contacte la coordination.',
          );
      }
      const a = await this.db.repo('availabilities', em).save({ ...v, professionalId: p.id });
      await this.auth.audit(u.id, 'availability.create', a.id, em);
      return a;
    });
  }
  async list(u: User, page = 1) {
    const q = this.db.repo('cares').createQueryBuilder('c');
    if (u.role === 'client') q.where('c."clientId"=:id', { id: u.id });
    else if (u.role === 'doctor' || u.role === 'nurse') {
      const p = await this.profile(u);
      if (p.verification !== 'approved') return { items: [], total: 0, page, pageSize: 10 };
      q.where('c."professionalId"=:id', { id: p.id });
    }
    const [items, total] = await q
      .orderBy('c."createdAt"', 'DESC')
      .skip((page - 1) * 10)
      .take(10)
      .getManyAndCount();
    return { items, total, page, pageSize: 10 };
  }
  async access(u: User, id: string, em?: EntityManager, lock = false): Promise<Care> {
    const c = await this.db
      .repo('cares', em)
      .findOne({ where: { id }, ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}) });
    if (!c) throw new NotFoundException('Demande introuvable.');
    if (u.role === 'client' && c.clientId === u.id) return c;
    if (u.role === 'admin' || u.role === 'operator') return c;
    if (u.role === 'doctor' || u.role === 'nurse') {
      const p = await this.db.repo('professionals', em).findOneBy({ userId: u.id });
      if (p?.id === c.professionalId && p.verification === 'approved') return c;
    }
    throw new NotFoundException('Demande introuvable.');
  }
  async detail(u: User, id: string) {
    const c = await this.access(u, id);
    await this.auth.audit(u.id, 'care.read', id);
    return {
      ...c,
      events: await this.db.repo('care_events').find({ where: { careId: id }, order: { createdAt: 'ASC' } }),
      invoice: await this.db.repo('invoices').findOneBy({ careId: id }),
    };
  }
  async create(u: User, body: unknown) {
    this.auth.require(u, ['client']);
    const v = careSchema.parse(body);
    const start = new Date(v.startAt);
    if (start.getTime() < Date.now() - 60000 || start.getTime() > Date.now() + 180 * 86400000)
      throw new BadRequestException('Choisis un créneau à venir dans les 180 jours.');
    const service = await this.db.repo('services').findOneBy({ id: v.serviceId, active: true });
    if (!service) throw new BadRequestException('Service indisponible.');
    const b = v.beneficiaryId
      ? await this.db.repo('beneficiaries').findOneBy({ id: v.beneficiaryId, ownerId: u.id, consent: true })
      : null;
    if (v.beneficiaryId && !b) throw new ForbiddenException('Bénéficiaire non autorisé.');
    const zone = await this.db.repo('zones').findOneBy({ name: v.zone, active: true });
    if (!zone) throw new BadRequestException('Zone non desservie. Contacte la coordination.');
    return this.db.source.transaction(async (em) => {
      const c = await this.db.repo('cares', em).save({
        clientId: u.id,
        beneficiaryId: b?.id ?? null,
        serviceId: service.id,
        serviceName: service.name,
        beneficiaryName: b?.name ?? u.name,
        description: v.description,
        address: v.address,
        zone: v.zone,
        latitude: v.latitude ?? null,
        longitude: v.longitude ?? null,
        startAt: start.toISOString(),
        endAt: new Date(start.getTime() + service.durationMinutes * 60000).toISOString(),
        urgent: v.urgent,
        status: 'submitted',
        professionalId: null,
        professionalName: null,
        estimate: service.price,
      });
      await this.db
        .repo('consents', em)
        .save({ userId: u.id, purpose: 'care-request', resourceId: c.id, version: '2026-10-v1' });
      await this.event(u, c, 'submitted', 'Demande reçue. La disponibilité reste à confirmer.', em);
      return c;
    });
  }
  async event(u: User, c: Care, status: CareStatus, note: string, em: EntityManager) {
    await this.db.repo('care_events', em).save({ careId: c.id, actorId: u.id, status, note });
    await this.auth.audit(u.id, 'care.' + status, c.id, em);
    await this.db.repo('notifications', em).save({
      userId: c.clientId,
      title: 'Mise à jour de votre demande',
      body: 'Votre espace SOS DOCTEURS a été mis à jour. Connectez-vous pour consulter les détails.',
      read: false,
    });
  }
  async transition(u: User, id: string, body: unknown) {
    const v = transitionSchema.parse(body);
    return this.db.source.transaction(async (em) => {
      const c = await this.access(u, id, em, true);
      if (!transitions[c.status].includes(v.status))
        throw new ConflictException('Cette transition n’est pas possible.');
      if (u.role === 'client') {
        if (
          v.status !== 'cancelled' ||
          !['draft', 'submitted', 'to_confirm', 'searching', 'assigned', 'accepted'].includes(c.status)
        )
          throw new ForbiddenException('Contacte la coordination pour cette action.');
      } else if (u.role === 'doctor' || u.role === 'nurse') {
        const allowed: Partial<Record<CareStatus, CareStatus[]>> = {
          assigned: ['accepted', 'searching'],
          accepted: ['en_route'],
          en_route: ['arrived'],
          arrived: ['in_progress'],
          in_progress: ['completed'],
        };
        if (!allowed[c.status]?.includes(v.status)) throw new ForbiddenException();
      } else if (!['to_confirm', 'searching', 'cancelled', 'failed'].includes(v.status))
        throw new ForbiddenException('Cette étape doit être confirmée par le professionnel.');
      if (v.status === 'completed' && c.estimate === null)
        throw new ConflictException('Le tarif doit être confirmé avant de terminer les soins.');
      const patch: Partial<Care> = { status: v.status };
      if (v.status === 'searching' || terminal.includes(v.status)) {
        await this.db.repo('assignments', em).update({ careId: id, active: true }, { active: false });
        if (v.status === 'searching') {
          patch.professionalId = null;
          patch.professionalName = null;
        }
      }
      await this.db.repo('cares', em).update({ id }, patch);
      if (v.status === 'completed')
        await this.db
          .repo('invoices', em)
          .save({ careId: id, clientId: c.clientId, amount: c.estimate!, currency: 'XOF', status: 'due' });
      await this.event(u, c, v.status, v.note || 'Statut mis à jour.', em);
      return this.db.repo('cares', em).findOneByOrFail({ id });
    });
  }
  async setQuote(u: User, id: string, body: unknown) {
    this.auth.require(u, ['admin', 'operator']);
    const { amount, confirm } = z
      .object({ amount: z.number().int().min(0).max(10000000), confirm: z.literal(true) })
      .strict()
      .parse(body);
    void confirm;
    return this.db.source.transaction(async (em) => {
      const c = await this.access(u, id, em, true);
      if (terminal.includes(c.status))
        throw new ConflictException('Le devis est figé après la fin des soins.');
      await this.db.repo('cares', em).update({ id }, { estimate: amount });
      await this.auth.audit(u.id, 'care.quote', id, em);
      return { ok: true };
    });
  }
  async eligible(c: Care, pId: string, em?: EntityManager) {
    const p = await this.db.repo('professionals', em).findOneBy({ id: pId, verification: 'approved' });
    if (!p) return null;
    const user = await this.db.repo('users', em).findOneBy({ id: p.userId, suspended: false });
    if (!user || user.role !== p.role) return null;
    const service = await this.db.repo('services', em).findOneByOrFail({ id: c.serviceId });
    if (!service.skills.every((s) => p.skills.includes(s)) || !p.zones.includes(c.zone)) return null;
    const slots = await this.db
      .repo('availabilities', em)
      .find({ where: { professionalId: p.id, startAt: LessThan(c.endAt), endAt: MoreThan(c.startAt) } });
    if (
      slots.some((a) => !a.available) ||
      !slots.some((a) => a.available && a.startAt <= c.startAt && a.endAt >= c.endAt)
    )
      return null;
    const conflict = await this.db
      .repo('cares', em)
      .createQueryBuilder('c')
      .where('c."professionalId"=:id', { id: p.id })
      .andWhere('c.id!=:careId', { careId: c.id })
      .andWhere('c.status NOT IN (:...statuses)', { statuses: terminal })
      .andWhere('c."startAt"<:end AND c."endAt">:start', { start: c.startAt, end: c.endAt })
      .getCount();
    if (conflict) return null;
    let distanceKm: number | null = null;
    if (c.latitude !== null && c.longitude !== null && p.latitude !== null && p.longitude !== null) {
      if (this.db.geo) {
        const rows = await (em ?? this.db.source.manager).query(
          'SELECT ST_Distance(location,ST_SetSRID(ST_MakePoint($1,$2),4326)::geography)/1000 AS distance FROM professionals WHERE id=$3 AND ST_DWithin(location,ST_SetSRID(ST_MakePoint($1,$2),4326)::geography,$4)',
          [c.longitude, c.latitude, p.id, p.radiusKm * 1000],
        );
        if (!rows.length) return null;
        distanceKm = Number(rows[0].distance);
      } else {
        const rad = (n: number) => (n * Math.PI) / 180;
        const a =
          Math.sin(rad(p.latitude - c.latitude) / 2) ** 2 +
          Math.cos(rad(c.latitude)) *
            Math.cos(rad(p.latitude)) *
            Math.sin(rad(p.longitude - c.longitude) / 2) ** 2;
        distanceKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        if (distanceKm > p.radiusKm) return null;
      }
    }
    return {
      id: p.id,
      name: p.name,
      specialty: p.specialty,
      distanceKm: distanceKm === null ? null : Math.round(distanceKm * 10) / 10,
      criteria: ['Compte vérifié', 'Compétences compatibles', 'Zone desservie', 'Créneau disponible'],
      geoMethod: this.db.geo ? 'PostGIS' : 'Calcul local de développement',
    };
  }
  async candidates(u: User, id: string) {
    this.auth.require(u, ['admin', 'operator']);
    const c = await this.access(u, id);
    const p = await this.db.repo('professionals').find({ where: { verification: 'approved' }, take: 200 });
    const all = await Promise.all(p.map((v) => this.eligible(c, v.id)));
    return all
      .filter((v): v is NonNullable<typeof v> => v !== null)
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  }
  async assign(u: User, id: string, body: unknown) {
    this.auth.require(u, ['admin', 'operator']);
    const { professionalId } = z.object({ professionalId: z.uuid() }).strict().parse(body);
    return this.db.source.transaction(async (em) => {
      const c = await this.access(u, id, em, true);
      if (c.status !== 'searching' || c.professionalId)
        throw new ConflictException('Cette demande n’est pas disponible pour une affectation.');
      await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['pro:' + professionalId]);
      const p = await this.eligible(c, professionalId, em);
      if (!p) throw new ConflictException('Professionnel non éligible ou créneau déjà occupé.');
      await this.db
        .repo('cares', em)
        .update({ id }, { professionalId, professionalName: p.name, status: 'assigned' });
      await this.db.repo('assignments', em).save({ careId: id, professionalId, actorId: u.id, active: true });
      const professional = await this.db.repo('professionals', em).findOneByOrFail({ id: professionalId });
      await this.db.repo('notifications', em).save({
        userId: professional.userId,
        title: 'Une mission vous est proposée',
        body: 'Consultez votre espace sécurisé pour répondre.',
        read: false,
      });
      await this.event(u, c, 'assigned', 'Proposition envoyée au professionnel. Acceptation attendue.', em);
      return this.db.repo('cares', em).findOneByOrFail({ id });
    });
  }
  async professionals(u: User) {
    this.auth.require(u, ['admin', 'operator']);
    const list = await this.db.repo('professionals').find({ take: 200 });
    return list.map(({ latitude: _latitude, longitude: _longitude, ...p }) => p);
  }
  async verify(u: User, id: string, body: unknown) {
    this.auth.require(u, ['admin']);
    const v = z
      .object({
        decision: z.enum(['approved', 'rejected']),
        reason: z.string().min(5).max(500),
        confirm: z.literal(true),
      })
      .strict()
      .parse(body);
    return this.db.source.transaction(async (em) => {
      await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['pro:' + id]);
      const p = await this.db.repo('professionals', em).findOneBy({ id });
      if (!p) throw new NotFoundException();
      if (v.decision === 'approved') {
        if (!p.skills.length || !p.zones.length)
          throw new BadRequestException('Compétences et zones requises.');
        if (!(await this.db.repo('documents', em).countBy({ userId: p.userId })))
          throw new BadRequestException('Un justificatif professionnel est requis.');
      }
      await this.db.repo('professionals', em).update({ id }, { verification: v.decision, reason: v.reason });
      await this.auth.audit(u.id, 'professional.' + v.decision, id, em);
      return { ok: true };
    });
  }
  async notes(u: User, id: string) {
    const c = await this.access(u, id);
    if (u.role === 'admin' || u.role === 'operator')
      throw new ForbiddenException('Accès clinique réservé au patient et au soignant affecté.');
    await this.auth.audit(u.id, 'notes.read', id);
    return this.db.repo('notes').find({ where: { careId: c.id }, order: { createdAt: 'ASC' } });
  }
  async addNote(u: User, id: string, body: unknown) {
    this.auth.require(u, ['doctor', 'nurse']);
    await this.access(u, id);
    const { content } = z
      .object({ content: z.string().trim().min(3).max(10000) })
      .strict()
      .parse(body);
    return this.db.source.transaction(async (em) => {
      const c = await this.access(u, id, em, true);
      if (!['in_progress', 'completed'].includes(c.status))
        throw new ConflictException('Notes disponibles pendant ou après les soins.');
      const n = await this.db.repo('notes', em).save({ careId: id, authorId: u.id, content });
      await this.auth.audit(u.id, 'notes.create', id, em);
      return n;
    });
  }
  async updateService(u: User, id: string, body: unknown) {
    this.auth.require(u, ['admin']);
    const v = z
      .object({
        name: z.string().min(2).max(100),
        description: z.string().min(5).max(1000),
        price: z.number().int().min(0).max(10000000).nullable(),
        active: z.boolean(),
        durationMinutes: z.number().int().min(15).max(480),
        skills: z.array(z.string().min(2).max(50)).min(1).max(15),
        category: z.string().min(2).max(50),
        confirm: z.literal(true),
      })
      .strict()
      .parse(body);
    const { confirm: _confirm, ...data } = v;
    await this.db.repo('services').update({ id }, data);
    await this.auth.audit(u.id, 'service.update', id);
    return { ok: true };
  }
}
