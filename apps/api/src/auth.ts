import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { loginSchema, registerSchema, passwordSchema, emailSchema, type User } from '@sos/contracts';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { MoreThan, type EntityManager } from 'typeorm';
import { Database } from './database';
import { hashPassword, verifyPassword, hashToken, opaqueToken } from './crypto';
import { demo } from './config';
import { AuditDetail } from './audit-details';
export type SessionUser = User & { sessionId: string; csrf: string };
export const publicUser = (u: User): User => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  role: u.role,
  suspended: u.suspended,
  createdAt: u.createdAt,
});
export class AuthService {
  constructor(readonly db: Database) {}
  async audit(
    actorId: string | null,
    action: string,
    resourceId: string | null = null,
    em?: EntityManager,
    details?: Record<string, unknown>,
  ) {
    const audit = await this.db.repo('audits', em).save({ actorId, action, resourceId });
    if (details)
      await (em ?? this.db.source.manager)
        .getRepository(AuditDetail)
        .save({ auditId: audit.id, content: JSON.stringify(details) });
  }
  async issue(user: User, em?: EntityManager) {
    const token = opaqueToken(),
      tokenHash = hashToken(token),
      expiresAt = new Date(Date.now() + 8 * 3600000).toISOString();
    const s = await this.db.repo('sessions', em).save({ userId: user.id, tokenHash, expiresAt });
    return {
      user: publicUser(user),
      token,
      csrf: hashToken(tokenHash + ':csrf'),
      expiresAt,
      sessionId: s.id,
    };
  }
  async register(body: unknown) {
    const v = registerSchema.parse(body);
    const passwordHash = await hashPassword(v.password);
    return this.db.source.transaction(async (em) => {
      if (await this.db.repo('users', em).findOneBy({ email: v.email }))
        throw new ConflictException('Ce compte existe déjà.');
      const u = await this.db
        .repo('users', em)
        .save({ name: v.name, email: v.email, phone: v.phone, role: v.role, passwordHash, suspended: false });
      if (v.role !== 'client')
        await this.db.repo('professionals', em).save({
          userId: u.id,
          name: u.name,
          role: u.role,
          specialty: 'À renseigner',
          skills: [],
          zones: [],
          verification: 'pending',
          reason: null,
          latitude: null,
          longitude: null,
          radiusKm: 30,
        });
      await this.db
        .repo('consents', em)
        .save({ userId: u.id, purpose: 'privacy-and-account', resourceId: u.id, version: '2026-10-v1' });
      await this.db
        .repo('preferences', em)
        .save({ userId: u.id, email: false, sms: false, push: false, pushToken: null });
      await this.audit(u.id, 'account.register', u.id, em);
      return this.issue(u, em);
    });
  }
  async login(body: unknown) {
    const v = loginSchema.parse(body),
      u = await this.db.repo('users').findOneBy({ email: v.email });
    const valid = await verifyPassword(v.password, u?.passwordHash ?? 'invalid:' + '0'.repeat(128));
    if (!u || !valid || u.suspended)
      throw new UnauthorizedException('Identifiants incorrects ou compte indisponible.');
    await this.audit(u.id, 'session.login', u.id);
    return this.issue(u);
  }
  async authenticate(token: string): Promise<SessionUser> {
    if (token.length > 200) throw new UnauthorizedException();
    const s = await this.db
      .repo('sessions')
      .findOneBy({ tokenHash: hashToken(token), expiresAt: MoreThan(new Date().toISOString()) });
    if (!s) throw new UnauthorizedException('Session expirée. Reconnecte-toi.');
    const u = await this.db.repo('users').findOneBy({ id: s.userId, suspended: false });
    if (!u) throw new UnauthorizedException('Accès révoqué.');
    return { ...publicUser(u), sessionId: s.id, csrf: hashToken(s.tokenHash + ':csrf') };
  }
  async logout(u: SessionUser) {
    await this.db.repo('sessions').delete({ id: u.sessionId, userId: u.id });
    await this.audit(u.id, 'session.logout', u.id);
    return { ok: true };
  }
  async rotate(u: SessionUser) {
    return this.db.source.transaction(async (em) => {
      await this.db.repo('sessions', em).delete({ id: u.sessionId, userId: u.id });
      return this.issue(u, em);
    });
  }
  async sessions(u: User) {
    const list = await this.db
      .repo('sessions')
      .find({ where: { userId: u.id }, order: { createdAt: 'DESC' }, take: 30 });
    return list.map((s) => ({ id: s.id, createdAt: s.createdAt, expiresAt: s.expiresAt }));
  }
  async revoke(u: User, id: string) {
    await this.db.repo('sessions').delete({ id, userId: u.id });
    await this.audit(u.id, 'session.revoke', id);
    return { ok: true };
  }
  async forgot(body: unknown) {
    const { email } = z.object({ email: emailSchema }).strict().parse(body);
    const u = await this.db.repo('users').findOneBy({ email });
    let developmentToken: string | undefined;
    if (u && !u.suspended) {
      const token = opaqueToken();
      await this.db.repo('password_resets').save({
        userId: u.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 30 * 60000).toISOString(),
        used: false,
      });
      if (demo) developmentToken = token;
      else if (process.env.RESEND_API_KEY && process.env.MAIL_FROM) {
        const result = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.MAIL_FROM,
            to: email,
            subject: 'Réinitialisation de votre accès SOS DOCTEURS',
            text: 'Code temporaire à saisir dans SOS DOCTEURS : ' + token + '. Valable 30 minutes.',
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (!result.ok) await this.audit(null, 'password.mail_failed', u.id);
      } else await this.audit(null, 'password.mail_unconfigured', u.id);
    }
    return {
      message: 'Si le compte existe, les instructions seront envoyées par le canal configuré.',
      ...(developmentToken ? { developmentToken, demo: true } : {}),
    };
  }
  async reset(body: unknown) {
    const { token, password } = z
      .object({ token: z.string().min(20).max(200), password: passwordSchema })
      .strict()
      .parse(body);
    const passwordHash = await hashPassword(password);
    await this.db.source.transaction(async (em) => {
      const r = await this.db
        .repo('password_resets', em)
        .findOne({ where: { tokenHash: hashToken(token) }, lock: { mode: 'pessimistic_write' } });
      if (!r || r.used || new Date(r.expiresAt) <= new Date())
        throw new BadRequestException('Code expiré ou invalide.');
      await this.db.repo('users', em).update({ id: r.userId }, { passwordHash });
      await this.db.repo('password_resets', em).update({ userId: r.userId }, { used: true });
      await this.db.repo('sessions', em).delete({ userId: r.userId });
      await this.audit(r.userId, 'password.reset', r.userId, em);
    });
    return { ok: true };
  }
  require(u: User, roles: User['role'][]) {
    if (!roles.includes(u.role)) throw new ForbiddenException('Action non autorisée.');
  }
  async suspend(u: User, id: string, body: unknown) {
    this.require(u, ['admin']);
    if (id === u.id) throw new ForbiddenException('Impossible de suspendre ton propre compte.');
    const { suspended, reason, confirm } = z
      .object({ suspended: z.boolean(), reason: z.string().min(5).max(500), confirm: z.literal(true) })
      .strict()
      .parse(body);
    void confirm;
    await this.db.source.transaction(async (em) => {
      await this.db.repo('users', em).update({ id }, { suspended });
      if (suspended) await this.db.repo('sessions', em).delete({ userId: id });
      await this.audit(u.id, suspended ? 'account.suspend' : 'account.reactivate', id, em, { reason });
    });
    return { ok: true };
  }
  newId() {
    return randomUUID();
  }
}
