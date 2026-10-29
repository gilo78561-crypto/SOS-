import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { User } from '@sos/contracts';
import { Database } from './database';
import { AuthService, publicUser } from './auth';
import { CareService } from './care';
import { encrypt, decrypt } from './crypto';
import { root, demo } from './config';
export class PrivateStorage {
  private s3 = process.env.STORAGE_BUCKET
    ? new S3Client({
        region: process.env.STORAGE_REGION ?? 'auto',
        endpoint: process.env.STORAGE_ENDPOINT,
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.STORAGE_ACCESS_KEY_ID!,
          secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY!,
        },
      })
    : null;
  async put(bytes: Buffer) {
    const key = randomUUID();
    const body = encrypt(bytes.toString('base64'));
    if (this.s3)
      await this.s3.send(
        new PutObjectCommand({
          Bucket: process.env.STORAGE_BUCKET,
          Key: key,
          Body: body,
          ContentType: 'application/octet-stream',
        }),
      );
    else {
      await mkdir(resolve(root, '.data/private'), { recursive: true });
      await writeFile(resolve(root, '.data/private', key), body, { mode: 0o600 });
    }
    return key;
  }
  async get(key: string) {
    z.uuid().parse(key);
    let data: string;
    if (this.s3) {
      const r = await this.s3.send(new GetObjectCommand({ Bucket: process.env.STORAGE_BUCKET, Key: key }));
      data = await r.Body!.transformToString();
    } else data = await readFile(resolve(root, '.data/private', key), 'utf8');
    return Buffer.from(decrypt(data), 'base64');
  }
}
export class ExtrasService {
  storage = new PrivateStorage();
  constructor(
    readonly db: Database,
    readonly auth: AuthService,
    readonly care: CareService,
  ) {}
  async users(u: User) {
    this.auth.require(u, ['admin']);
    return (await this.db.repo('users').find({ order: { createdAt: 'DESC' }, take: 200 })).map(publicUser);
  }
  async audits(u: User, page = 1) {
    this.auth.require(u, ['admin']);
    const [items, total] = await this.db
      .repo('audits')
      .findAndCount({ order: { createdAt: 'DESC' }, skip: (page - 1) * 25, take: 25 });
    return { items, total, page, pageSize: 25 };
  }
  async zones() {
    return this.db.repo('zones').find({ where: { active: true }, order: { name: 'ASC' } });
  }
  async setZone(u: User, body: unknown) {
    this.auth.require(u, ['admin']);
    const v = z
      .object({ name: z.string().trim().min(2).max(100), active: z.boolean() })
      .strict()
      .parse(body);
    const existing = await this.db.repo('zones').findOneBy({ name: v.name });
    const row = await this.db.repo('zones').save({ ...existing, ...v });
    await this.auth.audit(u.id, 'zone.update', row.id);
    return row;
  }
  async tickets(u: User) {
    return this.db.repo('tickets').find({
      where: ['admin', 'operator'].includes(u.role) ? {} : { userId: u.id },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }
  async ticket(u: User, body: unknown) {
    const v = z
      .object({ subject: z.string().trim().min(3).max(120), message: z.string().trim().min(5).max(2000) })
      .strict()
      .parse(body);
    const t = await this.db.repo('tickets').save({ ...v, userId: u.id, status: 'open', response: null });
    await this.auth.audit(u.id, 'support.create', t.id);
    return t;
  }
  async reply(u: User, id: string, body: unknown) {
    this.auth.require(u, ['admin', 'operator']);
    const v = z
      .object({ response: z.string().trim().min(3).max(2000), status: z.enum(['open', 'resolved']) })
      .strict()
      .parse(body);
    const t = await this.db.repo('tickets').findOneBy({ id });
    if (!t) throw new NotFoundException();
    await this.db.repo('tickets').update({ id }, v);
    await this.auth.audit(u.id, 'support.reply', id);
    return { ok: true };
  }
  async notifications(u: User) {
    return this.db
      .repo('notifications')
      .find({ where: { userId: u.id }, order: { createdAt: 'DESC' }, take: 100 });
  }
  async readNotification(u: User, id: string) {
    await this.db.repo('notifications').update({ id, userId: u.id }, { read: true });
    return { ok: true };
  }
  async preferences(u: User) {
    let p = await this.db.repo('preferences').findOneBy({ userId: u.id });
    if (!p)
      p = await this.db
        .repo('preferences')
        .save({ userId: u.id, email: false, sms: false, push: false, pushToken: null });
    return { email: p.email, sms: p.sms, push: p.push };
  }
  async setPreferences(u: User, body: unknown) {
    const v = z
      .object({
        email: z.boolean(),
        sms: z.boolean(),
        push: z.boolean(),
        pushToken: z
          .string()
          .regex(/^(ExponentPushToken|ExpoPushToken)\[[\w-]+\]$/)
          .nullable()
          .optional(),
        consent: z.literal(true),
      })
      .strict()
      .parse(body);
    await this.preferences(u);
    await this.db.source.transaction(async (em) => {
      await this.db.repo('preferences', em).update(
        { userId: u.id },
        {
          email: v.email,
          sms: v.sms,
          push: v.push,
          ...(v.pushToken !== undefined ? { pushToken: v.pushToken } : {}),
        },
      );
      await this.db
        .repo('consents', em)
        .save({ userId: u.id, purpose: 'notification-preferences', resourceId: null, version: '2026-10-v1' });
    });
    return this.preferences(u);
  }
  async dispatch(u: User) {
    this.auth.require(u, ['admin', 'operator']);
    const notifications = await this.db
      .repo('notifications')
      .find({ order: { createdAt: 'DESC' }, take: 100 });
    let sent = 0,
      blocked = 0;
    for (const n of notifications) {
      const pref = await this.db.repo('preferences').findOneBy({ userId: n.userId }),
        user = await this.db.repo('users').findOneBy({ id: n.userId, suspended: false });
      if (!pref || !user) continue;
      for (const channel of ['email', 'sms', 'push'] as const) {
        if (!pref[channel]) continue;
        await this.db.source.transaction(async (em) => {
          await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['notify:' + n.id + ':' + channel]);
          let d = await this.db
            .repo('notification_deliveries', em)
            .findOneBy({ notificationId: n.id, channel });
          if (d && (d.status === 'sent' || d.attempts >= 3)) return;
          d = await this.db.repo('notification_deliveries', em).save({
            ...d,
            notificationId: n.id,
            channel,
            status: 'processing',
            attempts: (d?.attempts ?? 0) + 1,
          });
          let response: Response | null = null;
          try {
            if (channel === 'email' && process.env.RESEND_API_KEY && process.env.MAIL_FROM)
              response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
                  'Content-Type': 'application/json',
                  'Idempotency-Key': d.id,
                },
                body: JSON.stringify({
                  from: process.env.MAIL_FROM,
                  to: user.email,
                  subject: 'Votre espace SOS DOCTEURS',
                  text: 'Une mise à jour vous attend dans votre espace sécurisé.',
                }),
                signal: AbortSignal.timeout(10000),
              });
            if (
              channel === 'sms' &&
              process.env.SMS_WEBHOOK_URL?.startsWith('https://') &&
              process.env.SMS_WEBHOOK_TOKEN
            )
              response = await fetch(process.env.SMS_WEBHOOK_URL, {
                method: 'POST',
                headers: {
                  Authorization: 'Bearer ' + process.env.SMS_WEBHOOK_TOKEN,
                  'Content-Type': 'application/json',
                  'Idempotency-Key': d.id,
                },
                body: JSON.stringify({
                  to: user.phone,
                  text: 'Une mise à jour vous attend dans votre espace SOS DOCTEURS.',
                }),
                signal: AbortSignal.timeout(10000),
              });
            if (channel === 'push' && pref.pushToken)
              response = await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(process.env.EXPO_ACCESS_TOKEN
                    ? { Authorization: 'Bearer ' + process.env.EXPO_ACCESS_TOKEN }
                    : {}),
                },
                body: JSON.stringify({
                  to: pref.pushToken,
                  title: 'SOS DOCTEURS',
                  body: 'Une mise à jour vous attend dans votre espace sécurisé.',
                }),
                signal: AbortSignal.timeout(10000),
              });
            let accepted = response?.ok ?? false;
            if (accepted && channel === 'push') {
              const payload = (await response!.json()) as { data?: { status?: string } };
              accepted = payload.data?.status === 'ok';
            }
            await this.db
              .repo('notification_deliveries', em)
              .update({ id: d.id }, { status: accepted ? 'sent' : response ? 'failed' : 'unconfigured' });
            if (accepted) sent++;
            else blocked++;
          } catch {
            await this.db.repo('notification_deliveries', em).update({ id: d.id }, { status: 'failed' });
            blocked++;
          }
        });
      }
    }
    await this.auth.audit(u.id, 'notifications.dispatch');
    return { sent, blocked };
  }
  async documents(u: User, targetId?: string) {
    const userId = targetId ?? u.id;
    if (userId !== u.id) this.auth.require(u, ['admin']);
    await this.auth.audit(u.id, 'documents.list', userId);
    return (await this.db.repo('documents').find({ where: { userId }, take: 30 })).map(
      ({ objectKey: _key, ...v }) => v,
    );
  }
  async upload(u: User, body: unknown) {
    this.auth.require(u, ['doctor', 'nurse']);
    const v = z
      .object({
        name: z.string().regex(/^[^"\r\n/\\]{1,120}$/),
        mime: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
        base64: z.string().max(7000000),
      })
      .strict()
      .parse(body);
    const bytes = Buffer.from(v.base64, 'base64');
    if (!bytes.length || bytes.length > 5 * 1024 * 1024)
      throw new BadRequestException('Fichier vide ou supérieur à 5 Mo.');
    const valid =
      v.mime === 'application/pdf'
        ? bytes.subarray(0, 5).toString() === '%PDF-'
        : v.mime === 'image/jpeg'
          ? bytes[0] === 255 && bytes[1] === 216
          : bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
    if (!valid) throw new BadRequestException('Le contenu ne correspond pas au type de fichier.');
    if ((await this.db.repo('documents').countBy({ userId: u.id })) >= 20)
      throw new BadRequestException('Maximum 20 justificatifs.');
    const objectKey = await this.storage.put(bytes);
    const d = await this.db.repo('documents').save({ userId: u.id, name: v.name, mime: v.mime, objectKey });
    await this.auth.audit(u.id, 'document.upload', d.id);
    const { objectKey: _key, ...data } = d;
    return data;
  }
  async download(u: User, id: string) {
    const d = await this.db.repo('documents').findOneBy({ id });
    if (!d || (d.userId !== u.id && u.role !== 'admin')) throw new NotFoundException();
    await this.auth.audit(u.id, 'document.read', id);
    return { bytes: await this.storage.get(d.objectKey), name: d.name, mime: d.mime };
  }
  async consultation(u: User, id: string, body: unknown) {
    z.object({ consent: z.literal(true) })
      .strict()
      .parse(body);
    const c = await this.care.access(u, id);
    this.auth.require(u, ['client', 'doctor', 'nurse']);
    const service = await this.db.repo('services').findOneByOrFail({ id: c.serviceId });
    if (service.category !== 'video')
      throw new BadRequestException('Cette demande ne concerne pas une téléconsultation.');
    if (!['accepted', 'en_route', 'arrived', 'in_progress'].includes(c.status))
      throw new ConflictException('Une mission acceptée est nécessaire.');
    if (!process.env.DAILY_API_KEY) {
      if (!demo) throw new ServiceUnavailableException('Fournisseur vidéo non configuré.');
      return {
        simulated: true,
        status: 'simulation',
        joinUrl: null,
        message: 'Simulation de salle : aucun appel vidéo réel.',
      };
    }
    if (
      Date.now() < new Date(c.startAt).getTime() - 15 * 60000 ||
      Date.now() > new Date(c.endAt).getTime() + 60 * 60000
    )
      throw new ConflictException(
        'La salle ouvre 15 minutes avant le créneau et reste accessible jusqu’à une heure après.',
      );
    await this.db
      .repo('consents')
      .save({ userId: u.id, purpose: 'teleconsultation', resourceId: id, version: '2026-10-v1' });
    const expiry = Math.floor((new Date(c.endAt).getTime() + 60 * 60000) / 1000);
    const name = 'sos-' + c.id;
    let consultation = await this.db.repo('consultations').findOneBy({ careId: id });
    if (!consultation) {
      const r = await fetch('https://api.daily.co/v1/rooms', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + process.env.DAILY_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          privacy: 'private',
          properties: { exp: expiry, enable_chat: false, enable_prejoin_ui: true },
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok && r.status !== 400)
        throw new ServiceUnavailableException('Création de salle non confirmée.');
      let room: unknown = await r.json();
      if (!r.ok) {
        const existing = await fetch('https://api.daily.co/v1/rooms/' + name, {
          headers: { Authorization: 'Bearer ' + process.env.DAILY_API_KEY },
          signal: AbortSignal.timeout(10000),
        });
        if (!existing.ok) throw new ServiceUnavailableException('Salle indisponible.');
        room = await existing.json();
      }
      const { url } = z.object({ url: z.url() }).parse(room);
      await this.db.repo('consultations').upsert(
        {
          careId: id,
          status: 'ready',
          consentAt: new Date().toISOString(),
          expiresAt: new Date(expiry * 1000).toISOString(),
          roomUrl: url,
          simulated: false,
        },
        ['careId'],
      );
      consultation = await this.db.repo('consultations').findOneByOrFail({ careId: id });
    }
    const r = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.DAILY_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: {
          room_name: name,
          exp: Math.min(expiry, Math.floor(Date.now() / 1000) + 15 * 60),
          user_id: u.id,
          user_name: u.role === 'client' ? 'Patient' : 'Professionnel',
          is_owner: u.role !== 'client',
        },
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new ServiceUnavailableException('Accès vidéo indisponible.');
    const { token } = z.object({ token: z.string() }).parse(await r.json());
    await this.auth.audit(u.id, 'consultation.join', id);
    return {
      simulated: false,
      status: 'ready',
      joinUrl: consultation.roomUrl + '?t=' + encodeURIComponent(token),
    };
  }
  async assistant(u: User, body: unknown) {
    this.auth.require(u, ['client']);
    const { message } = z
      .object({ message: z.string().trim().min(2).max(1500) })
      .strict()
      .parse(body);
    const urgent =
      /douleur.*poitrine|respir|inconscien|saignement.*important|danger immédiat|urgence vitale/i.test(
        message,
      );
    const limits =
      'Ces informations générales ne remplacent pas une consultation. Aucun diagnostic ni prescription.';
    if (urgent)
      return {
        mode: 'safety',
        urgent: true,
        answer:
          'En cas de danger immédiat, contacte les services d’urgence locaux ou rends-toi au service d’urgence le plus proche. N’attends pas une réponse de cette application. ' +
          limits,
      };
    let topic: 'services' | 'paiement' | 'confidentialite' | 'orientation' = 'orientation';
    if (/service|consultation|infirm|échograph|ecg|prélèvement/i.test(message)) topic = 'services';
    else if (/pai|tarif|prix|facture/i.test(message)) topic = 'paiement';
    else if (/donnée|confidential|privé/i.test(message)) topic = 'confidentialite';
    const answers = {
      services:
        'Tu peux demander une consultation à domicile, des soins infirmiers, un prélèvement, une échographie, un ECG ou une téléconsultation. La coordination confirme la disponibilité du professionnel.',
      paiement:
        'Le paiement intervient après les soins terminés. Un devis est confirmé par la coordination. MTN, Moov et Celtiis dépendent des prestataires effectivement activés.',
      confidentialite:
        'Les demandes et les notes sont accessibles uniquement selon les autorisations. N’envoie pas de pièce d’identité ni d’informations médicales dans cet assistant.',
      orientation:
        'Pour une question sur des symptômes ou un traitement, demande un avis à un professionnel. Je peux expliquer les services, les tarifs et le fonctionnement de SOS DOCTEURS.',
    };
    if (
      topic === 'orientation' ||
      process.env.AI_ENABLED !== 'true' ||
      !process.env.OPENAI_API_KEY ||
      !process.env.OPENAI_MODEL
    )
      return { mode: 'sans-ia', urgent: false, answer: answers[topic] + ' ' + limits };
    try {
      const r = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + process.env.OPENAI_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL,
          store: false,
          instructions:
            'Explique en français, en moins de 100 mots, les informations administratives fournies. Aucune affirmation de diagnostic, traitement ou disponibilité garantie. Ne complète pas les faits.',
          input: answers[topic],
          max_output_tokens: 250,
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (!r.ok) throw new Error('AI unavailable');
      const data = z
        .object({
          output: z.array(
            z.object({
              content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional(),
            }),
          ),
        })
        .parse(await r.json());
      const text = data.output
        .flatMap((o) => o.content ?? [])
        .map((c) => c.text ?? '')
        .join('');
      return {
        mode: 'ia-informations-services',
        urgent: false,
        answer: (text || answers[topic]) + ' ' + limits,
      };
    } catch {
      return { mode: 'sans-ia', urgent: false, answer: answers[topic] + ' ' + limits };
    }
  }
}
