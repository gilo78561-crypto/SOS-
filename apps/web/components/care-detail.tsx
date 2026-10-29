'use client';
import { useState } from 'react';
import { MapPin, Video, Check, ArrowRight } from 'lucide-react';
import { type Care, type User, type CareStatus, money, localDate, statusLabels } from '@sos/contracts';
import { api, errorText } from '../lib/api';
import { useAction } from '../lib/hooks';
import { Status } from './workspace-ui';
type Candidate = {
  id: string;
  name: string;
  specialty: string;
  distanceKm: number | null;
  criteria: string[];
  geoMethod: string;
};
export function CareDetail({
  initial,
  user,
  onChanged,
}: {
  initial: Care;
  user: User;
  onChanged: () => void;
}) {
  const [c, setCare] = useState(initial),
    [candidates, setCandidates] = useState<Candidate[] | null>(null),
    [quote, setQuote] = useState(initial.estimate?.toString() ?? ''),
    [confirmQuote, setConfirmQuote] = useState(false),
    [note, setNote] = useState(''),
    [notes, setNotes] = useState<{ id: string; content: string; createdAt: string }[] | null>(null),
    [content, setContent] = useState(''),
    [video, setVideo] = useState('');
  const action = useAction(),
    ops = ['admin', 'operator'].includes(user.role),
    pro = ['doctor', 'nurse'].includes(user.role);
  async function refresh() {
    setCare(await api<Care>('/cares/' + c.id));
    onChanged();
  }
  async function transition(status: CareStatus) {
    if (
      ['cancelled', 'failed'].includes(status) &&
      !window.confirm('Confirmer cette action pour la demande ?')
    )
      return;
    await action.run(async () => {
      await api('/cares/' + c.id + '/transition', 'POST', { status, note });
      await refresh();
    });
  }
  const next: Partial<Record<CareStatus, CareStatus[]>> = {
    assigned: ['accepted', 'searching'],
    accepted: ['en_route'],
    en_route: ['arrived'],
    arrived: ['in_progress'],
    in_progress: ['completed'],
  };
  async function showNotes() {
    try {
      setNotes(await api('/cares/' + c.id + '/notes'));
    } catch (e) {
      action.setError(errorText(e));
    }
  }
  return (
    <>
      <div className="record-head">
        <div>
          <p className="eyebrow">DEMANDE · {c.id.slice(0, 8).toUpperCase()}</p>
          <h3>{c.serviceName}</h3>
          <p className="small muted">{c.beneficiaryName}</p>
        </div>
        <Status status={c.status} />
      </div>
      {action.error && (
        <div className="alert" role="alert">
          {action.error}
        </div>
      )}
      {action.success && (
        <div className="alert alert-success" role="status">
          {action.success}
        </div>
      )}
      <dl className="info-list">
        <div>
          <dt>Créneau souhaité</dt>
          <dd>{localDate(c.startAt)}</dd>
        </div>
        <div>
          <dt>Professionnel</dt>
          <dd>{c.professionalName ?? 'À confirmer'}</dd>
        </div>
        <div>
          <dt>Adresse</dt>
          <dd>
            {c.address} · {c.zone}
          </dd>
        </div>
        <div>
          <dt>Estimation</dt>
          <dd>{money(c.estimate)}</dd>
        </div>
      </dl>
      <p className="small muted">{c.description}</p>
      {c.latitude !== null && c.longitude !== null && (
        <a
          className="text-link"
          href={
            'https://www.openstreetmap.org/?mlat=' +
            c.latitude +
            '&mlon=' +
            c.longitude +
            '#map=17/' +
            c.latitude +
            '/' +
            c.longitude
          }
          target="_blank"
          rel="noreferrer"
        >
          <MapPin size={15} /> Voir le point sur OpenStreetMap
        </a>
      )}
      {ops && !['completed', 'failed', 'cancelled'].includes(c.status) && (
        <div className="panel">
          <h3 className="small">Devis à confirmer</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action.run(async () => {
                await api('/cares/' + c.id + '/quote', 'POST', {
                  amount: Number(quote),
                  confirm: confirmQuote,
                });
                await refresh();
              });
            }}
          >
            <label className="field">
              <span>Montant total (XOF)</span>
              <input
                type="number"
                min="0"
                max="10000000"
                step="1"
                required
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
              />
            </label>
            <label className="check-field">
              <input
                required
                type="checkbox"
                checked={confirmQuote}
                onChange={(e) => setConfirmQuote(e.target.checked)}
              />
              <span>Je confirme le tarif convenu pour cette demande.</span>
            </label>
            <button className="btn btn-sm" disabled={action.busy}>
              Confirmer le devis
            </button>
          </form>
        </div>
      )}
      <div className="actions">
        {ops && ['submitted', 'to_confirm'].includes(c.status) && (
          <button className="btn btn-sm" disabled={action.busy} onClick={() => transition('searching')}>
            Rechercher un professionnel <ArrowRight size={15} />
          </button>
        )}
        {pro &&
          (next[c.status] ?? []).map((s) => (
            <button
              className={'btn btn-sm' + (s === 'searching' ? ' btn-outline' : '')}
              disabled={action.busy}
              key={s}
              onClick={() => transition(s)}
            >
              {s === 'searching'
                ? 'Refuser la mission'
                : s === 'completed'
                  ? 'Confirmer les soins terminés'
                  : statusLabels[s]}
            </button>
          ))}
        {(ops || user.role === 'client') &&
          ['submitted', 'to_confirm', 'searching', 'assigned', 'accepted'].includes(c.status) && (
            <button
              className="btn btn-outline btn-sm"
              disabled={action.busy}
              onClick={() => transition('cancelled')}
            >
              Annuler la demande
            </button>
          )}
      </div>
      {ops && c.status === 'searching' && (
        <section className="panel" style={{ marginTop: 20 }}>
          <h3>Professionnels éligibles</h3>
          <p className="small muted">
            Compétences, zone, disponibilité, validation et distance si les deux points sont connus.
          </p>
          <button
            className="btn btn-outline btn-sm"
            disabled={action.busy}
            onClick={() =>
              action.run(
                async () => setCandidates(await api<Candidate[]>('/cares/' + c.id + '/candidates')),
                'Recherche terminée.',
              )
            }
          >
            Actualiser la recherche
          </button>
          {candidates?.length === 0 && (
            <p className="small muted">
              Aucun professionnel compatible avec ce créneau. Contacte le patient pour proposer un autre
              créneau.
            </p>
          )}
          {candidates?.map((p) => (
            <div className="record-card" key={p.id}>
              <strong className="small">{p.name}</strong>
              <p>
                {p.specialty}
                {p.distanceKm !== null ? ' · ' + p.distanceKm + ' km' : ''}
              </p>
              <p>{p.criteria.join(' · ')}</p>
              <button
                className="btn btn-sm"
                disabled={action.busy}
                onClick={() =>
                  action.run(async () => {
                    await api('/cares/' + c.id + '/assign', 'POST', { professionalId: p.id });
                    await refresh();
                    setCandidates(null);
                  })
                }
              >
                Proposer cette mission
              </button>
            </div>
          ))}
        </section>
      )}
      {c.serviceName === 'Téléconsultation' &&
        ['client', 'doctor', 'nurse'].includes(user.role) &&
        ['accepted', 'en_route', 'arrived', 'in_progress'].includes(c.status) && (
          <div className="panel" style={{ marginTop: 20 }}>
            <h3>Salle de consultation</h3>
            <p className="small muted">
              En continuant, tu consens à la téléconsultation via le prestataire vidéo configuré.
            </p>
            <button
              className="btn btn-sm"
              disabled={action.busy}
              onClick={() =>
                action.run(async () => {
                  const r = await api<{ simulated: boolean; joinUrl: string | null; message?: string }>(
                    '/cares/' + c.id + '/consultation',
                    'POST',
                    { consent: true },
                  );
                  if (r.joinUrl) setVideo(r.joinUrl);
                  else setVideo(r.message ?? 'Salle non disponible.');
                }, 'Accès vérifié.')
              }
            >
              <Video size={16} /> Accéder à la salle
            </button>
            {video.startsWith('https://') ? (
              <a className="btn btn-outline btn-sm" href={video} rel="noreferrer" target="_blank">
                Ouvrir la consultation privée
              </a>
            ) : (
              video && <p className="notice">{video}</p>
            )}
          </div>
        )}
      <h3 style={{ marginTop: 26, fontSize: 16 }}>Les étapes de votre prise en charge</h3>
      <ol className="timeline">
        {c.events?.map((e) => (
          <li key={e.id}>
            <strong>{statusLabels[e.status]}</strong>
            <small>{localDate(e.createdAt)}</small>
            <p>{e.note}</p>
          </li>
        ))}
      </ol>
      {c.invoice && (
        <div className="wizard-summary">
          <h3>Facture · {c.invoice.id.slice(0, 8).toUpperCase()}</h3>
          <p>
            {money(c.invoice.amount)} ·{' '}
            {c.invoice.status === 'paid'
              ? 'Réglée'
              : c.invoice.status === 'refunded'
                ? 'Remboursée'
                : 'À régler après les soins'}
          </p>
          <p>Retrouve le paiement et le reçu dans l’onglet Paiements.</p>
        </div>
      )}
      {!ops && (
        <div className="actions">
          <button className="btn btn-outline btn-sm" onClick={showNotes}>
            Consulter les notes de soins
          </button>
        </div>
      )}
      {notes && (
        <div className="panel" style={{ marginTop: 20 }}>
          <h3>Notes de soins privées</h3>
          {notes.length === 0 ? (
            <p className="small muted">Aucune note pour le moment.</p>
          ) : (
            notes.map((n) => (
              <div key={n.id}>
                <small>{localDate(n.createdAt)}</small>
                <p className="small" style={{ whiteSpace: 'pre-wrap' }}>
                  {n.content}
                </p>
              </div>
            ))
          )}
          {pro && ['in_progress', 'completed'].includes(c.status) && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void action.run(async () => {
                  await api('/cares/' + c.id + '/notes', 'POST', { content });
                  setContent('');
                  await showNotes();
                });
              }}
            >
              <label className="field">
                <span>Note de soins</span>
                <textarea
                  required
                  minLength={3}
                  maxLength={10000}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </label>
              <button className="btn btn-sm" disabled={action.busy}>
                <Check size={15} /> Enregistrer la note
              </button>
            </form>
          )}
        </div>
      )}
      {ops && (
        <label className="field" style={{ marginTop: 20 }}>
          <span>Note de suivi pour la prochaine action (sans détail clinique)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </label>
      )}
    </>
  );
}
