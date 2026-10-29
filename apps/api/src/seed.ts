import { Database } from './database';
import { hashPassword } from './crypto';
import { demo } from './config';
import { PrivateStorage } from './extras';
import type { Role } from '@sos/contracts';
export async function seed(db: Database) {
  const services = [
    {
      name: 'Consultation à domicile',
      description: 'Un médecin généraliste ou spécialiste, chez vous ou au bureau.',
      category: 'home',
      skills: ['consultation'],
      durationMinutes: 60,
    },
    {
      name: 'Soins infirmiers',
      description: 'Des soins de proximité, organisés avec un professionnel qualifié.',
      category: 'nursing',
      skills: ['nursing'],
      durationMinutes: 60,
    },
    {
      name: 'Prélèvement à domicile',
      description: 'Un prélèvement sanguin organisé à l’adresse de votre choix.',
      category: 'lab',
      skills: ['sampling'],
      durationMinutes: 30,
    },
    {
      name: 'Échographie à domicile',
      description: 'Un examen à domicile, selon indication et disponibilité.',
      category: 'imaging',
      skills: ['ultrasound'],
      durationMinutes: 60,
    },
    {
      name: 'ECG à domicile',
      description: 'Un électrocardiogramme réalisé par un professionnel habilité.',
      category: 'ecg',
      skills: ['ecg'],
      durationMinutes: 45,
    },
    {
      name: 'Téléconsultation',
      description: 'Un rendez-vous vidéo privé avec un médecin, sur réservation.',
      category: 'video',
      skills: ['consultation'],
      durationMinutes: 30,
    },
  ];
  for (const s of services)
    if (!(await db.repo('services').findOneBy({ name: s.name })))
      await db.repo('services').save({ ...s, price: null, active: true });
  for (const name of ['Cotonou', 'Abomey-Calavi', 'Porto-Novo'])
    if (!(await db.repo('zones').findOneBy({ name }))) await db.repo('zones').save({ name, active: true });
  if (!demo) return;
  if (!process.env.DEMO_PASSWORD || process.env.DEMO_PASSWORD.length < 12)
    throw new Error('DEMO_PASSWORD requis.');
  const passwordHash = await hashPassword(process.env.DEMO_PASSWORD);
  const accounts: [Role, string, string][] = [
    ['client', 'patient', 'Patient Démonstration'],
    ['client', 'proche', 'Autre Patient Démonstration'],
    ['doctor', 'medecin', 'Médecin Démonstration'],
    ['nurse', 'infirmier', 'Infirmier Démonstration'],
    ['operator', 'coordination', 'Coordination Démonstration'],
    ['admin', 'admin', 'Administration Démonstration'],
  ];
  for (const [role, handle, name] of accounts) {
    let u = await db.repo('users').findOneBy({ email: handle + '@demo.sos.test' });
    if (!u)
      u = await db.repo('users').save({
        name,
        email: handle + '@demo.sos.test',
        phone: '+2290190000000',
        role,
        passwordHash,
        suspended: false,
      });
    if (!(await db.repo('preferences').findOneBy({ userId: u.id })))
      await db
        .repo('preferences')
        .save({ userId: u.id, email: false, sms: false, push: false, pushToken: null });
    if (role === 'doctor' || role === 'nurse') {
      let p = await db.repo('professionals').findOneBy({ userId: u.id });
      if (!p)
        p = await db.repo('professionals').save({
          userId: u.id,
          name,
          role,
          specialty: role === 'doctor' ? 'Médecine générale (fictif)' : 'Soins infirmiers (fictif)',
          skills: role === 'doctor' ? ['consultation', 'ultrasound', 'ecg'] : ['nursing', 'sampling', 'ecg'],
          zones: ['Cotonou', 'Abomey-Calavi', 'Porto-Novo'],
          verification: 'approved',
          reason: 'Profil de démonstration uniquement.',
          latitude: 6.3703,
          longitude: 2.3912,
          radiusKm: 30,
        });
      if (!(await db.repo('availabilities').countBy({ professionalId: p.id }))) {
        const start = new Date();
        start.setUTCHours(0, 0, 0, 0);
        for (let day = 0; day < 14; day++) {
          const s = new Date(start.getTime() + day * 86400000 + 6 * 3600000);
          await db.repo('availabilities').save({
            professionalId: p.id,
            startAt: s.toISOString(),
            endAt: new Date(s.getTime() + 14 * 3600000).toISOString(),
            available: true,
          });
        }
      }
      if (!(await db.repo('documents').countBy({ userId: u.id }))) {
        const objectKey = await new PrivateStorage().put(
          Buffer.from('%PDF-1.4\nJustificatif FICTIF. Sans valeur professionnelle.\n%%EOF'),
        );
        await db
          .repo('documents')
          .save({ userId: u.id, name: 'Justificatif-fictif.pdf', mime: 'application/pdf', objectKey });
      }
    }
  }
  console.log('Seed démo : comptes @demo.sos.test ; aucun patient ni prix inventé.');
}
