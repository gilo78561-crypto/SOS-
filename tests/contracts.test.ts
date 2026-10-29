import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { registerSchema, beneficiarySchema, careSchema, availabilitySchema, professionalSchema, paymentSchema, transitions } from '@sos/contracts';

const registration = { name: 'Patient fictif', email: 'test@example.test', password: 'Test-Password-2026!', phone: '+2290190000000', consent: true };
const care = { serviceId: randomUUID(), description: 'Demande fictive de test', address: 'Adresse fictive Cotonou', zone: 'Cotonou', startAt: '2026-11-02T09:00:00+01:00', consent: true };
describe('Contrats partagés et limites de confiance', () => {
  it('normalise les e-mails et attribue seulement le rôle client par défaut', () => {
    const result = registerSchema.parse({ ...registration, email: ' PATIENT@EXAMPLE.TEST ' });
    expect(result.email).toBe('patient@example.test');
    expect(result.role).toBe('client');
  });
  it.each(['admin', 'operator'])('interdit le rôle privilégié %s à l’inscription', (role) => {
    expect(registerSchema.safeParse({ ...registration, role }).success).toBe(false);
  });
  it('rejette les champs pouvant contourner la validation professionnelle', () => {
    expect(registerSchema.safeParse({ ...registration, verification: 'approved' }).success).toBe(false);
  });
  it('exige un consentement explicite pour le compte et le bénéficiaire', () => {
    expect(registerSchema.safeParse({ ...registration, consent: false }).success).toBe(false);
    expect(beneficiarySchema.safeParse({ name: 'Proche fictif', relationship: 'Parent', consent: false }).success).toBe(false);
  });
  it('rejette les dates de naissance impossibles', () => {
    expect(beneficiarySchema.safeParse({ name: 'Proche fictif', relationship: 'Parent', consent: true, birthDate: '2026-02-30' }).success).toBe(false);
  });
  it('normalise les créneaux en UTC', () => {
    expect(careSchema.parse(care).startAt).toBe('2026-11-02T08:00:00.000Z');
  });
  it('autorise une adresse manuelle mais refuse des coordonnées partielles ou invalides', () => {
    expect(careSchema.safeParse(care).success).toBe(true);
    expect(careSchema.safeParse({ ...care, latitude: 6.37 }).success).toBe(false);
    expect(careSchema.safeParse({ ...care, latitude: 95, longitude: 2.39 }).success).toBe(false);
  });
  it('empêche le patient de fixer le montant ou le professionnel', () => {
    expect(careSchema.safeParse({ ...care, estimate: 1 }).success).toBe(false);
    expect(careSchema.safeParse({ ...care, professionalId: randomUUID() }).success).toBe(false);
  });
  it('refuse les créneaux inversés même avec des décalages horaires différents', () => {
    expect(availabilitySchema.safeParse({ startAt: '2026-11-02T09:00:00Z', endAt: '2026-11-02T09:30:00+01:00', available: true }).success).toBe(false);
  });
  it('empêche un professionnel de se valider lui-même', () => {
    expect(professionalSchema.safeParse({ specialty: 'Soins', skills: ['nursing'], zones: ['Cotonou'], radiusKm: 30, verification: 'approved' }).success).toBe(false);
  });
  it('contrôle les opérateurs de paiement et le numéro béninois', () => {
    expect(paymentSchema.safeParse({ provider: 'mtn', phone: '+2290190000000' }).success).toBe(true);
    expect(paymentSchema.safeParse({ provider: 'unknown', phone: '+2290190000000' }).success).toBe(false);
    expect(paymentSchema.safeParse({ provider: 'mtn', phone: '90000000' }).success).toBe(false);
  });
  it('interdit la réouverture d’une intervention terminée, annulée ou échouée', () => {
    for (const status of ['completed', 'cancelled', 'failed'] as const) expect(transitions[status]).toEqual([]);
    expect(transitions.submitted).not.toContain('completed');
    expect(transitions.assigned).toContain('searching');
  });
});
