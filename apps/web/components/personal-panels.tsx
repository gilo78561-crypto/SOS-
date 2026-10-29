'use client';
import { useState, useEffect } from 'react';
import { Plus, CalendarDays, Check, Upload, Download, ShieldCheck } from 'lucide-react';
import type {
  Beneficiary,
  Availability,
  Professional,
  DocumentInfo,
  User,
  Notification,
} from '@sos/contracts';
import { localDate } from '@sos/contracts';
import { api } from '../lib/api';
import { useAction, useResource } from '../lib/hooks';
import { Empty, Modal } from './workspace-ui';
export function Feedback({ action, extra }: { action: ReturnType<typeof useAction>; extra?: string }) {
  return (
    <>
      {(action.error || extra) && (
        <div className="alert" role="alert">
          {action.error || extra}
        </div>
      )}
      {action.success && (
        <div className="alert alert-success" role="status">
          {action.success}
        </div>
      )}
    </>
  );
}
export function BeneficiariesPanel() {
  const r = useResource<Beneficiary[]>('/beneficiaries', []),
    a = useAction(),
    [open, setOpen] = useState(false),
    [f, setF] = useState({ name: '', relationship: 'Parent', birthDate: '', consent: false });
  return (
    <>
      <Feedback action={a} extra={r.error} />
      <div className="panel-heading">
        <h2>Les personnes dont vous prenez soin</h2>
        <button className="btn btn-sm" onClick={() => setOpen(true)}>
          <Plus size={16} /> Ajouter un proche
        </button>
      </div>
      {r.data.length === 0 ? (
        <Empty
          title="Votre carnet de proches"
          text="Ajoutez les personnes que vous êtes autorisé à accompagner. Vous pourrez demander un soin pour elles."
        />
      ) : (
        <div className="grid-two">
          {r.data.map((b) => (
            <article className="record-card" key={b.id}>
              <span className="pill">{b.relationship}</span>
              <h3 style={{ marginTop: 15 }}>{b.name}</h3>
              <p>{b.birthDate ? 'Né(e) le ' + b.birthDate : 'Date de naissance non renseignée'}</p>
              <p>Autorisation de gestion confirmée.</p>
            </article>
          ))}
        </div>
      )}
      {open && (
        <Modal title="Ajouter un proche" onClose={() => setOpen(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void a.run(async () => {
                await api('/beneficiaries', 'POST', { ...f, birthDate: f.birthDate || null });
                setOpen(false);
                setF({ name: '', relationship: 'Parent', birthDate: '', consent: false });
                await r.refresh();
              });
            }}
          >
            <Feedback action={a} />
            <label className="field">
              <span>Nom et prénom</span>
              <input
                required
                minLength={2}
                maxLength={100}
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Votre lien</span>
              <select value={f.relationship} onChange={(e) => setF({ ...f, relationship: e.target.value })}>
                {['Parent', 'Enfant', 'Conjoint', 'Autre proche'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Date de naissance (facultative)</span>
              <input
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={f.birthDate}
                onChange={(e) => setF({ ...f, birthDate: e.target.value })}
              />
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                required
                checked={f.consent}
                onChange={(e) => setF({ ...f, consent: e.target.checked })}
              />
              <span>Je confirme être autorisé à gérer les demandes de soins de cette personne.</span>
            </label>
            <button className="btn" disabled={a.busy}>
              Enregistrer le proche
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function AvailabilityPanel() {
  const r = useResource<Availability[]>('/professional/availability', []),
    a = useAction(),
    [f, setF] = useState({ startAt: '', endAt: '', available: true });
  return (
    <>
      <Feedback action={a} extra={r.error} />
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h2>Déclarer une disponibilité</h2>
            <p>
              Vos autres activités restent privées. Seuls les créneaux disponibles servent à l’affectation.
            </p>
          </div>
          <CalendarDays size={24} />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void a.run(async () => {
              await api('/professional/availability', 'POST', {
                startAt: new Date(f.startAt + ':00+01:00').toISOString(),
                endAt: new Date(f.endAt + ':00+01:00').toISOString(),
                available: f.available,
              });
              await r.refresh();
            });
          }}
        >
          <div className="form-grid">
            <label className="field">
              <span>Début (Bénin, UTC+1)</span>
              <input
                required
                type="datetime-local"
                value={f.startAt}
                onChange={(e) => setF({ ...f, startAt: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Fin (Bénin, UTC+1)</span>
              <input
                required
                type="datetime-local"
                value={f.endAt}
                onChange={(e) => setF({ ...f, endAt: e.target.value })}
              />
            </label>
          </div>
          <label className="field">
            <span>Type de période</span>
            <select
              value={String(f.available)}
              onChange={(e) => setF({ ...f, available: e.target.value === 'true' })}
            >
              <option value="true">Disponible pour SOS DOCTEURS</option>
              <option value="false">Indisponible (prioritaire)</option>
            </select>
          </label>
          <button className="btn btn-sm" disabled={a.busy}>
            Enregistrer le créneau
          </button>
        </form>
      </div>
      <div className="panel">
        <h3>Vos périodes déclarées</h3>
        {!r.data.length ? (
          <Empty
            title="Aucun créneau déclaré"
            text="Ajoutez vos disponibilités pour pouvoir recevoir une mission."
          />
        ) : (
          r.data.map((v) => (
            <div className="record-card" key={v.id}>
              <span className={'pill' + (!v.available ? ' pill-red' : '')}>
                {v.available ? 'Disponible' : 'Indisponible'}
              </span>
              <p style={{ margin: '10px 0 0' }}>
                {localDate(v.startAt)} → {localDate(v.endAt)}
              </p>
            </div>
          ))
        )}
      </div>
    </>
  );
}
export async function downloadDocument(d: DocumentInfo) {
  const r = await fetch(
    (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api') + '/documents/' + d.id + '/content',
    { credentials: 'include' },
  );
  if (!r.ok) throw new Error('Téléchargement non autorisé ou indisponible.');
  const url = URL.createObjectURL(await r.blob()),
    link = document.createElement('a');
  link.href = url;
  link.download = d.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ProfilePanel() {
  const r = useResource<Professional | null>('/professional/profile', null),
    docs = useResource<DocumentInfo[]>('/documents', []),
    a = useAction(),
    [f, setF] = useState({ specialty: '', skills: '', zones: '', radiusKm: 30, latitude: '', longitude: '' });
  useEffect(() => {
    if (r.data)
      setF({
        specialty: r.data.specialty,
        skills: r.data.skills.join(', '),
        zones: r.data.zones.join(', '),
        radiusKm: r.data.radiusKm,
        latitude: r.data.latitude?.toString() ?? '',
        longitude: r.data.longitude?.toString() ?? '',
      });
  }, [r.data]);
  return (
    <>
      <Feedback action={a} extra={r.error || docs.error} />
      <div className="notice">
        Toute modification du profil nécessite une nouvelle vérification. Votre position précise n’est pas
        affichée publiquement.
      </div>
      <div className="panel" style={{ marginTop: 20 }}>
        <div className="panel-heading">
          <h2>Votre profil professionnel</h2>
          <span className="pill">
            {r.data?.verification === 'approved'
              ? 'Vérifié'
              : r.data?.verification === 'rejected'
                ? 'À corriger'
                : 'À vérifier'}
          </span>
        </div>
        {r.data?.reason && <p className="small muted">{r.data.reason}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void a.run(async () => {
              await api('/professional/profile', 'PATCH', {
                specialty: f.specialty,
                skills: f.skills
                  .split(',')
                  .map((v) => v.trim())
                  .filter(Boolean),
                zones: f.zones
                  .split(',')
                  .map((v) => v.trim())
                  .filter(Boolean),
                radiusKm: f.radiusKm,
                latitude: f.latitude ? Number(f.latitude) : null,
                longitude: f.longitude ? Number(f.longitude) : null,
              });
              await r.refresh();
            });
          }}
        >
          <label className="field">
            <span>Spécialité / compétences professionnelles</span>
            <input value={f.specialty} onChange={(e) => setF({ ...f, specialty: e.target.value })} required />
          </label>
          <label className="field">
            <span>Compétences (séparées par des virgules)</span>
            <input value={f.skills} onChange={(e) => setF({ ...f, skills: e.target.value })} required />
            <small>Codes : consultation, nursing, sampling, ultrasound, ecg.</small>
          </label>
          <label className="field">
            <span>Zones d’intervention (séparées par des virgules)</span>
            <input value={f.zones} onChange={(e) => setF({ ...f, zones: e.target.value })} required />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>Latitude de départ (facultative)</span>
              <input
                type="number"
                step="any"
                min="-90"
                max="90"
                value={f.latitude}
                onChange={(e) => setF({ ...f, latitude: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Longitude de départ (facultative)</span>
              <input
                type="number"
                step="any"
                min="-180"
                max="180"
                value={f.longitude}
                onChange={(e) => setF({ ...f, longitude: e.target.value })}
              />
            </label>
          </div>
          <label className="field">
            <span>Rayon d’intervention (km)</span>
            <input
              type="number"
              required
              min="1"
              max="100"
              value={f.radiusKm}
              onChange={(e) => setF({ ...f, radiusKm: Number(e.target.value) })}
            />
          </label>
          <button className="btn" disabled={a.busy}>
            <Check size={16} /> Enregistrer et soumettre à vérification
          </button>
        </form>
      </div>
      <div className="panel">
        <h3>Justificatifs privés</h3>
        <p className="small muted">
          PDF, JPEG ou PNG · 5 Mo maximum. Accessibles à vous et aux administrateurs chargés de la validation.
        </p>
        <label className="field">
          <span>
            <Upload size={15} /> Ajouter un justificatif
          </span>
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            disabled={a.busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void a.run(async () => {
                if (file.size > 5 * 1024 * 1024) throw new Error('Fichier supérieur à 5 Mo.');
                const base64 = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(String(reader.result).split(',')[1]);
                  reader.onerror = () => reject(new Error('Lecture impossible.'));
                  reader.readAsDataURL(file);
                });
                await api('/documents', 'POST', { name: file.name, mime: file.type, base64 });
                await docs.refresh();
              });
              e.target.value = '';
            }}
          />
        </label>
        {docs.data.map((d) => (
          <div className="record-head" key={d.id}>
            <span className="small">{d.name}</span>
            <button
              className="btn btn-outline btn-sm"
              disabled={a.busy}
              onClick={() => a.run(() => downloadDocument(d), 'Fichier téléchargé.')}
            >
              <Download size={15} /> Télécharger
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
export function NotificationsPanel() {
  const r = useResource<Notification[]>('/notifications', []),
    a = useAction();
  return (
    <div className="panel">
      <Feedback action={a} extra={r.error} />
      <h2 style={{ fontSize: 22 }}>Votre actualité</h2>
      {r.data.length === 0 ? (
        <Empty title="Aucune notification" text="Les mises à jour de vos demandes apparaîtront ici." />
      ) : (
        r.data.map((n) => (
          <article className="notification-item" key={n.id}>
            <strong>{n.title}</strong> {!n.read && <span className="pill">Nouveau</span>}
            <p>{n.body}</p>
            <small className="muted">{localDate(n.createdAt)}</small>
            {!n.read && (
              <button
                className="btn btn-outline btn-sm"
                onClick={() =>
                  a.run(async () => {
                    await api('/notifications/' + n.id + '/read', 'PATCH');
                    await r.refresh();
                  })
                }
              >
                Marquer comme lu
              </button>
            )}
          </article>
        ))
      )}
    </div>
  );
}
export function SettingsPanel({ user }: { user: User }) {
  const r = useResource<{ email: boolean; sms: boolean; push: boolean } | null>('/preferences', null),
    sessions = useResource<{ id: string; createdAt: string; expiresAt: string }[]>('/auth/sessions', []),
    a = useAction();
  return (
    <>
      <Feedback action={a} extra={r.error || sessions.error} />
      <div className="panel">
        <h2 style={{ fontSize: 22 }}>Votre compte</h2>
        <dl className="info-list">
          <div>
            <dt>Nom</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>E-mail</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Téléphone</dt>
            <dd>{user.phone}</dd>
          </div>
        </dl>
      </div>
      <div className="panel">
        <h3>Notifications et consentement</h3>
        <p className="small muted">
          Les envois externes dépendent des prestataires configurés. Les notifications de l’espace restent
          disponibles.
        </p>
        {r.data &&
          (['email', 'sms', 'push'] as const).map((k) => (
            <label className="check-field" key={k}>
              <input
                type="checkbox"
                checked={r.data![k]}
                disabled={a.busy}
                onChange={(e) =>
                  a.run(async () => {
                    await api('/preferences', 'PATCH', { ...r.data, [k]: e.target.checked, consent: true });
                    await r.refresh();
                  })
                }
              />
              <span>
                {k === 'email'
                  ? 'Recevoir des e-mails'
                  : k === 'sms'
                    ? 'Recevoir des SMS'
                    : 'Recevoir des notifications push (appareil enregistré nécessaire)'}
              </span>
            </label>
          ))}
      </div>
      <div className="panel">
        <div className="panel-heading">
          <h2>Sessions de votre compte</h2>
          <ShieldCheck size={22} />
        </div>
        {sessions.data.map((s) => (
          <div className="record-head" key={s.id}>
            <span className="small">
              Ouverte le {localDate(s.createdAt)}
              <br />
              <span className="muted">Expire le {localDate(s.expiresAt)}</span>
            </span>
            <button
              className="btn btn-outline btn-sm"
              disabled={a.busy}
              onClick={() => {
                if (
                  window.confirm(
                    'Révoquer cette session ? Si elle est active sur cet appareil, tu devras te reconnecter.',
                  )
                )
                  void a.run(async () => {
                    await api('/auth/sessions/' + s.id, 'DELETE');
                    await sessions.refresh();
                  });
              }}
            >
              Révoquer
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
