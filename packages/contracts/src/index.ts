import { z } from 'zod';

export const roles = ['client', 'doctor', 'nurse', 'operator', 'admin'] as const;
export type Role = (typeof roles)[number];
export const roleLabels: Record<Role, string> = {
  client: 'Patient', doctor: 'Médecin', nurse: 'Infirmier', operator: 'Coordination', admin: 'Administration',
};
export const statuses = ['draft', 'submitted', 'to_confirm', 'searching', 'assigned', 'accepted', 'en_route', 'arrived', 'in_progress', 'completed', 'cancelled', 'failed'] as const;
export type CareStatus = (typeof statuses)[number];
export const statusLabels: Record<CareStatus, string> = {
  draft: 'Brouillon', submitted: 'Demande reçue', to_confirm: 'À confirmer', searching: 'Recherche en cours',
  assigned: 'Professionnel proposé', accepted: 'Mission acceptée', en_route: 'En route', arrived: 'Sur place',
  in_progress: 'Soins en cours', completed: 'Terminée', cancelled: 'Annulée', failed: 'Non réalisée',
};
// Role-specific permissions are enforced by the API in addition to this state graph.
export const transitions: Record<CareStatus, CareStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['to_confirm', 'searching', 'cancelled', 'failed'],
  to_confirm: ['searching', 'cancelled', 'failed'],
  searching: ['assigned', 'cancelled', 'failed'],
  assigned: ['accepted', 'searching', 'cancelled', 'failed'],
  accepted: ['en_route', 'cancelled', 'failed'],
  en_route: ['arrived', 'cancelled', 'failed'],
  arrived: ['in_progress', 'cancelled', 'failed'],
  in_progress: ['completed', 'failed'],
  completed: [], cancelled: [], failed: [],
};

export const emailSchema = z.string().trim().max(254).email('Adresse e-mail invalide.').toLowerCase();
export const passwordSchema = z.string().min(12, 'Utilisez au moins 12 caractères.').max(128);
export const phoneSchema = z.string().trim().regex(/^\+22901\d{8}$/, 'Téléphone attendu : +22901 suivi de 8 chiffres.');
const nameSchema = z.string().trim().min(2).max(100);
const dateTimeSchema = z.iso.datetime({ offset: true }).transform((v) => new Date(v).toISOString());
const coordinates = {
  latitude: z.number().finite().min(-90).max(90).nullable().optional(),
  longitude: z.number().finite().min(-180).max(180).nullable().optional(),
};
const pairedCoordinates = (v: { latitude?: number | null; longitude?: number | null }) =>
  (v.latitude == null) === (v.longitude == null);

export const registerSchema = z.object({
  name: nameSchema, email: emailSchema, password: passwordSchema, phone: phoneSchema,
  role: z.enum(['client', 'doctor', 'nurse']).default('client'), consent: z.literal(true),
}).strict();
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) }).strict();
export const beneficiarySchema = z.object({
  name: nameSchema, relationship: z.string().trim().min(2).max(80),
  birthDate: z.iso.date().refine((v) => v <= new Date().toISOString().slice(0, 10), 'Date de naissance future.').nullable().optional(),
  consent: z.literal(true),
}).strict();
export const careSchema = z.object({
  serviceId: z.uuid(), beneficiaryId: z.uuid().nullable().optional(),
  description: z.string().trim().min(5).max(2000), address: z.string().trim().min(5).max(500),
  zone: z.string().trim().min(2).max(100), startAt: dateTimeSchema,
  urgent: z.boolean().default(false), consent: z.literal(true), ...coordinates,
}).strict().refine(pairedCoordinates, { message: 'Latitude et longitude requises ensemble.', path: ['latitude'] });
export const availabilitySchema = z.object({
  startAt: dateTimeSchema, endAt: dateTimeSchema, available: z.boolean(),
}).strict().refine((v) => v.endAt > v.startAt, { message: 'La fin doit suivre le début.', path: ['endAt'] });
export const professionalSchema = z.object({
  specialty: z.string().trim().min(2).max(150),
  skills: z.array(z.string().trim().min(2).max(50)).min(1).max(15),
  zones: z.array(z.string().trim().min(2).max(100)).min(1).max(30),
  radiusKm: z.number().finite().min(1).max(200), ...coordinates,
}).strict().refine(pairedCoordinates, { message: 'Latitude et longitude requises ensemble.', path: ['latitude'] });
export const transitionSchema = z.object({
  status: z.enum(statuses), note: z.string().trim().max(1000).optional(),
}).strict();
export const paymentSchema = z.object({ provider: z.enum(['mtn', 'moov', 'celtiis']), phone: phoneSchema }).strict();

interface RecordBase { id: string; createdAt: string }
export interface User extends RecordBase { name: string; email: string; phone: string; role: Role; suspended: boolean }
export interface Professional extends RecordBase {
  userId: string; name: string; role: 'doctor' | 'nurse'; specialty: string; skills: string[]; zones: string[];
  verification: 'pending' | 'approved' | 'rejected'; reason: string | null;
  latitude: number | null; longitude: number | null; radiusKm: number;
}
export interface Service extends RecordBase { name: string; description: string; category: string; skills: string[]; durationMinutes: number; price: number | null; active: boolean }
export interface Beneficiary extends RecordBase { ownerId: string; name: string; relationship: string; birthDate: string | null; consent: boolean }
export interface Care extends RecordBase {
  clientId: string; beneficiaryId: string | null; serviceId: string; serviceName: string; beneficiaryName: string;
  description: string; address: string; zone: string; latitude: number | null; longitude: number | null;
  startAt: string; endAt: string; urgent: boolean; status: CareStatus; professionalId: string | null;
  professionalName: string | null; estimate: number | null; events?: CareEvent[]; invoice?: Invoice | null;
}
export interface CareEvent extends RecordBase { careId: string; actorId: string; status: CareStatus; note: string }
export interface Invoice extends RecordBase { careId: string; clientId: string; amount: number; currency: 'XOF'; status: 'due' | 'paid' | 'refunded' }
export interface Payment extends RecordBase {
  invoiceId: string; userId: string; provider: 'mtn' | 'moov' | 'celtiis'; amount: number; currency: 'XOF';
  status: 'pending' | 'succeeded' | 'failed' | 'expired' | 'refunded'; checkoutUrl: string | null; simulated: boolean;
}
export interface Availability extends RecordBase { professionalId: string; startAt: string; endAt: string; available: boolean }
export interface Notification extends RecordBase { userId: string; title: string; body: string; read: boolean }
export interface Ticket extends RecordBase { userId: string; subject: string; message: string; status: 'open' | 'resolved'; response: string | null }
export interface Audit extends RecordBase { actorId: string | null; action: string; resourceId: string | null }
export interface Consultation extends RecordBase { careId: string; status: string; consentAt: string; expiresAt: string | null; roomUrl: string | null; simulated: boolean }
export interface DocumentInfo extends RecordBase { userId: string; name: string; mime: string }
export interface Capabilities { demo: boolean; payments: string; video: boolean; ai: boolean; maps: string }
export const money = (amount: number | null | undefined) => amount == null ? 'Sur devis' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(amount);
export const localDate = (value: string) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Porto-Novo' }).format(new Date(value));
