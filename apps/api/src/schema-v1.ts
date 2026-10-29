import { EntitySchema, type EntitySchemaColumnOptions } from 'typeorm';
import type {
  User,
  Professional,
  Service,
  Beneficiary,
  Care,
  CareEvent,
  Invoice,
  Payment,
  Availability,
  Notification,
  Ticket,
  Audit,
  Consultation,
  DocumentInfo,
} from '@sos/contracts';
import { encrypted } from './crypto';
export interface Tables {
  users: User & { passwordHash: string };
  professionals: Professional;
  services: Service;
  beneficiaries: Beneficiary;
  cares: Omit<Care, 'events' | 'invoice'>;
  care_events: CareEvent;
  invoices: Invoice;
  payments: Payment & {
    idempotencyKey: string;
    fingerprint: string;
    externalId: string | null;
    expiresAt: string;
    phoneCipher: string;
  };
  availabilities: Availability;
  notifications: Notification;
  tickets: Ticket;
  audits: Audit;
  consultations: Consultation;
  documents: DocumentInfo & { objectKey: string };
  sessions: { id: string; userId: string; tokenHash: string; expiresAt: string; createdAt: string };
  password_resets: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: string;
    used: boolean;
    createdAt: string;
  };
  consents: {
    id: string;
    userId: string;
    purpose: string;
    resourceId: string | null;
    version: string;
    createdAt: string;
  };
  assignments: {
    id: string;
    careId: string;
    professionalId: string;
    actorId: string;
    active: boolean;
    createdAt: string;
  };
  notes: { id: string; careId: string; authorId: string; content: string; createdAt: string };
  payment_events: {
    id: string;
    paymentId: string;
    externalEventId: string;
    status: string;
    createdAt: string;
  };
  refunds: {
    id: string;
    paymentId: string;
    actorId: string;
    amount: number;
    reason: string;
    status: string;
    createdAt: string;
  };
  notification_deliveries: {
    id: string;
    notificationId: string;
    channel: string;
    status: string;
    attempts: number;
    createdAt: string;
  };
  preferences: {
    id: string;
    userId: string;
    email: boolean;
    sms: boolean;
    push: boolean;
    pushToken: string | null;
    createdAt: string;
  };
  zones: { id: string; name: string; active: boolean; createdAt: string };
  settings: { id: string; key: string; value: string; createdAt: string };
}
const c = (type: string, nullable = false): EntitySchemaColumnOptions => ({
  type: type as 'varchar',
  nullable,
});
const t = (nullable = false): EntitySchemaColumnOptions => ({
  ...c('timestamptz', nullable),
  transformer: { to: (v: string | null) => v, from: (v: Date | null) => v?.toISOString() ?? null },
});
const base = {
  id: { type: 'uuid', primary: true, generated: 'uuid' } as EntitySchemaColumnOptions,
  createdAt: { ...t(), default: () => 'CURRENT_TIMESTAMP' },
};
const secure = (nullable = false): EntitySchemaColumnOptions => ({
  ...c('text', nullable),
  transformer: encrypted,
});
function entity<K extends keyof Tables>(name: K, columns: Record<string, EntitySchemaColumnOptions>) {
  return new EntitySchema<Tables[K]>({
    name,
    tableName: name,
    columns: { ...base, ...columns } as Record<keyof Tables[K], EntitySchemaColumnOptions>,
  });
}
export const schema = {
  users: entity('users', {
    name: c('varchar'),
    email: { ...c('varchar'), unique: true },
    phone: c('varchar'),
    role: c('varchar'),
    passwordHash: c('text'),
    suspended: { ...c('boolean'), default: false },
  }),
  professionals: entity('professionals', {
    userId: { ...c('uuid'), unique: true },
    name: c('varchar'),
    role: c('varchar'),
    specialty: c('varchar'),
    skills: c('jsonb'),
    zones: c('jsonb'),
    verification: c('varchar'),
    reason: c('text', true),
    latitude: c('double precision', true),
    longitude: c('double precision', true),
    radiusKm: { ...c('integer'), default: 30 },
  }),
  services: entity('services', {
    name: c('varchar'),
    description: c('text'),
    category: c('varchar'),
    skills: c('jsonb'),
    durationMinutes: c('integer'),
    price: c('integer', true),
    active: { ...c('boolean'), default: true },
  }),
  beneficiaries: entity('beneficiaries', {
    ownerId: c('uuid'),
    name: c('varchar'),
    relationship: c('varchar'),
    birthDate: c('date', true),
    consent: c('boolean'),
  }),
  cares: entity('cares', {
    clientId: c('uuid'),
    beneficiaryId: c('uuid', true),
    serviceId: c('uuid'),
    serviceName: c('varchar'),
    beneficiaryName: c('varchar'),
    description: secure(),
    address: secure(),
    zone: c('varchar'),
    latitude: c('double precision', true),
    longitude: c('double precision', true),
    startAt: t(),
    endAt: t(),
    urgent: c('boolean'),
    status: c('varchar'),
    professionalId: c('uuid', true),
    professionalName: c('varchar', true),
    estimate: c('integer', true),
  }),
  care_events: entity('care_events', {
    careId: c('uuid'),
    actorId: c('uuid'),
    status: c('varchar'),
    note: c('text'),
  }),
  invoices: entity('invoices', {
    careId: { ...c('uuid'), unique: true },
    clientId: c('uuid'),
    amount: c('integer'),
    currency: c('varchar'),
    status: c('varchar'),
  }),
  payments: entity('payments', {
    invoiceId: c('uuid'),
    userId: c('uuid'),
    provider: c('varchar'),
    amount: c('integer'),
    currency: c('varchar'),
    status: c('varchar'),
    checkoutUrl: c('text', true),
    simulated: c('boolean'),
    idempotencyKey: c('varchar'),
    fingerprint: c('varchar'),
    externalId: { ...c('varchar', true), unique: true },
    expiresAt: t(),
    phoneCipher: secure(),
  }),
  availabilities: entity('availabilities', {
    professionalId: c('uuid'),
    startAt: t(),
    endAt: t(),
    available: c('boolean'),
  }),
  notifications: entity('notifications', {
    userId: c('uuid'),
    title: c('varchar'),
    body: c('text'),
    read: { ...c('boolean'), default: false },
  }),
  tickets: entity('tickets', {
    userId: c('uuid'),
    subject: c('varchar'),
    message: secure(),
    status: c('varchar'),
    response: secure(true),
  }),
  audits: entity('audits', { actorId: c('uuid', true), action: c('varchar'), resourceId: c('uuid', true) }),
  consultations: entity('consultations', {
    careId: { ...c('uuid'), unique: true },
    status: c('varchar'),
    consentAt: t(),
    expiresAt: t(true),
    roomUrl: secure(true),
    simulated: c('boolean'),
  }),
  documents: entity('documents', {
    userId: c('uuid'),
    name: c('varchar'),
    mime: c('varchar'),
    objectKey: c('varchar'),
  }),
  sessions: entity('sessions', {
    userId: c('uuid'),
    tokenHash: { ...c('varchar'), unique: true },
    expiresAt: t(),
  }),
  password_resets: entity('password_resets', {
    userId: c('uuid'),
    tokenHash: { ...c('varchar'), unique: true },
    expiresAt: t(),
    used: c('boolean'),
  }),
  consents: entity('consents', {
    userId: c('uuid'),
    purpose: c('varchar'),
    resourceId: c('uuid', true),
    version: c('varchar'),
  }),
  assignments: entity('assignments', {
    careId: c('uuid'),
    professionalId: c('uuid'),
    actorId: c('uuid'),
    active: c('boolean'),
  }),
  notes: entity('notes', { careId: c('uuid'), authorId: c('uuid'), content: secure() }),
  payment_events: entity('payment_events', {
    paymentId: c('uuid'),
    externalEventId: { ...c('varchar'), unique: true },
    status: c('varchar'),
  }),
  refunds: entity('refunds', {
    paymentId: c('uuid'),
    actorId: c('uuid'),
    amount: c('integer'),
    reason: c('text'),
    status: c('varchar'),
  }),
  notification_deliveries: entity('notification_deliveries', {
    notificationId: c('uuid'),
    channel: c('varchar'),
    status: c('varchar'),
    attempts: c('integer'),
  }),
  preferences: entity('preferences', {
    userId: { ...c('uuid'), unique: true },
    email: c('boolean'),
    sms: c('boolean'),
    push: c('boolean'),
    pushToken: secure(true),
  }),
  zones: entity('zones', { name: { ...c('varchar'), unique: true }, active: c('boolean') }),
  settings: entity('settings', { key: { ...c('varchar'), unique: true }, value: c('text') }),
};
