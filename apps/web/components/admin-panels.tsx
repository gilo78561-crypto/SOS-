'use client';
import { useState } from 'react';
import { Users, Download, ShieldCheck, Settings2 } from 'lucide-react';
import {
  type User,
  type Professional,
  type DocumentInfo,
  type Service,
  type Audit,
  roleLabels,
  money,
  localDate,
} from '@sos/contracts';
import { api } from '../lib/api';
import { useAction, useResource } from '../lib/hooks';
import { Feedback, downloadDocument } from './personal-panels';
import { Modal, Empty, Pagination } from './workspace-ui';
function VerifyProfessional({ p, onDone }: { p: Professional; onDone: () => void }) {
  const docs = useResource<DocumentInfo[]>('/documents?userId=' + p.userId, []),
    a = useAction(),
    [reason, setReason] = useState(''),
    [decision, setDecision] = useState('approved'),
    [confirm, setConfirm] = useState(false);
  return (
    <>
      <Feedback action={a} extra={docs.error} />
      <p className="small muted">
        {p.specialty} · {p.skills.join(', ')}
        <br />
        {p.zones.join(', ')}
      </p>
      <h3>Justificatifs privés</h3>
      {docs.data.map((d) => (
        <div className="record-head" key={d.id}>
          <span className="small">{d.name}</span>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => a.run(() => downloadDocument(d), 'Téléchargé.')}
          >
            <Download size={15} /> Examiner
          </button>
        </div>
      ))}
      {docs.data.length === 0 && (
        <p className="notice">
          Aucun justificatif. La validation sera refusée tant qu’un document n’est pas fourni.
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void a.run(async () => {
            await api('/professionals/' + p.id + '/verify', 'POST', { decision, reason, confirm });
            onDone();
          }, 'Décision enregistrée.');
        }}
      >
        <label className="field">
          <span>Décision</span>
          <select value={decision} onChange={(e) => setDecision(e.target.value)}>
            <option value="approved">Accepter</option>
            <option value="rejected">Refuser / révoquer la validation</option>
          </select>
        </label>
        <label className="field">
          <span>Motif et vérifications effectuées</span>
          <textarea
            minLength={5}
            maxLength={500}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <label className="check-field">
          <input type="checkbox" required checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
          <span>Je confirme cette décision administrative et les vérifications nécessaires.</span>
        </label>
        <button className="btn" disabled={a.busy}>
          <ShieldCheck size={16} /> Confirmer la décision
        </button>
      </form>
    </>
  );
}
export function TeamPanel({ user }: { user: User }) {
  const r = useResource<Professional[]>('/professionals', []),
    a = useAction(),
    [selected, setSelected] = useState<Professional | null>(null),
    [filter, setFilter] = useState('all');
  return (
    <>
      <Feedback action={a} extra={r.error} />
      <div className="row-tools">
        <label className="field">
          <span>État de vérification</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Tous les professionnels</option>
            <option value="pending">À vérifier</option>
            <option value="approved">Vérifiés</option>
            <option value="rejected">Refusés</option>
          </select>
        </label>
      </div>
      <div className="grid-two">
        {r.data
          .filter((p) => filter === 'all' || p.verification === filter)
          .map((p) => (
            <article className="record-card" key={p.id}>
              <div className="record-head">
                <span className="icon-tile">
                  <Users size={21} />
                </span>
                <span className={'pill' + (p.verification === 'approved' ? '' : ' pill-warn')}>
                  {p.verification === 'approved'
                    ? 'Vérifié'
                    : p.verification === 'pending'
                      ? 'À vérifier'
                      : 'Refusé'}
                </span>
              </div>
              <h3>{p.name}</h3>
              <p>
                {p.specialty}
                <br />
                {p.zones.join(', ') || 'Zones non renseignées'}
              </p>
              <p>{p.skills.join(' · ') || 'Compétences non renseignées'}</p>
              {user.role === 'admin' && (
                <button className="btn btn-outline btn-sm" onClick={() => setSelected(p)}>
                  Examiner le dossier
                </button>
              )}
            </article>
          ))}
      </div>
      {!r.data.length && (
        <Empty
          title="Aucun professionnel"
          text="Les inscriptions de médecins et d’infirmiers apparaîtront ici."
        />
      )}
      {selected && (
        <Modal title={selected.name} onClose={() => setSelected(null)}>
          <VerifyProfessional
            p={selected}
            onDone={() => {
              setSelected(null);
              void r.refresh();
            }}
          />
        </Modal>
      )}
    </>
  );
}
export function UsersPanel({ self }: { self: User }) {
  const r = useResource<User[]>('/admin/users', []),
    a = useAction(),
    [search, setSearch] = useState('');
  return (
    <div className="panel">
      <Feedback action={a} extra={r.error} />
      <label className="field">
        <span>Rechercher un compte</span>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom ou e-mail" />
      </label>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Compte</th>
              <th>Rôle</th>
              <th>État</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {r.data
              .filter((u) => (u.name + ' ' + u.email).toLowerCase().includes(search.toLowerCase()))
              .map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.name}
                    <small>{u.email}</small>
                  </td>
                  <td>{roleLabels[u.role]}</td>
                  <td>{u.suspended ? 'Suspendu' : 'Actif'}</td>
                  <td>
                    {u.id !== self.id && (
                      <button
                        className="btn btn-outline btn-sm"
                        disabled={a.busy}
                        onClick={() => {
                          const reason = window.prompt(
                            'Motif de la ' +
                              (u.suspended ? 'réactivation' : 'suspension') +
                              ' (5 caractères minimum)',
                          );
                          if (
                            !reason ||
                            !window.confirm('Confirmer cette modification pour ' + u.name + ' ?')
                          )
                            return;
                          void a.run(async () => {
                            await api('/admin/users/' + u.id, 'PATCH', {
                              suspended: !u.suspended,
                              reason,
                              confirm: true,
                            });
                            await r.refresh();
                          });
                        }}
                      >
                        {u.suspended ? 'Réactiver' : 'Suspendre'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export function ServicesPanel() {
  const r = useResource<Service[]>('/admin/services', []),
    zones = useResource<{ id: string; name: string; active: boolean }[]>('/zones', []),
    a = useAction(),
    [selected, setSelected] = useState<Service | null>(null),
    [price, setPrice] = useState(''),
    [zone, setZone] = useState('');
  return (
    <>
      <Feedback action={a} extra={r.error || zones.error} />
      <div className="notice" style={{ marginBottom: 20 }}>
        Les tarifs initiaux sont « sur devis ». Les prix ci-dessous sont administrables et ne constituent pas
        un barème médical validé.
      </div>
      <div className="grid-two">
        {r.data.map((s) => (
          <article className="record-card" key={s.id}>
            <span className="pill">{s.active ? 'Actif' : 'Désactivé'}</span>
            <h3 style={{ marginTop: 12 }}>{s.name}</h3>
            <p>{s.description}</p>
            <strong>{money(s.price)}</strong>
            <p>
              {s.durationMinutes} minutes · {s.skills.join(', ')}
            </p>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                setSelected(s);
                setPrice(s.price?.toString() ?? '');
              }}
            >
              <Settings2 size={15} /> Configurer
            </button>
          </article>
        ))}
      </div>
      <div className="panel">
        <h3>Zones desservies</h3>
        <p className="small muted">{zones.data.map((z) => z.name).join(' · ')}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void a.run(async () => {
              await api('/admin/zones', 'POST', { name: zone, active: true });
              setZone('');
              await zones.refresh();
            });
          }}
        >
          <label className="field">
            <span>Ajouter / réactiver une zone</span>
            <input
              required
              minLength={2}
              maxLength={100}
              value={zone}
              onChange={(e) => setZone(e.target.value)}
            />
          </label>
          <button className="btn btn-sm" disabled={a.busy}>
            Enregistrer la zone
          </button>
        </form>
        <div className="actions">
          {zones.data.map((z) => (
            <button
              key={z.id}
              className="btn btn-outline btn-sm"
              disabled={a.busy}
              onClick={() => {
                if (window.confirm('Désactiver les nouvelles demandes pour ' + z.name + ' ?'))
                  void a.run(async () => {
                    await api('/admin/zones', 'POST', { name: z.name, active: false });
                    await zones.refresh();
                  });
              }}
            >
              Désactiver {z.name}
            </button>
          ))}
        </div>
      </div>
      {selected && (
        <Modal title="Configurer le service" onClose={() => setSelected(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (
                !window.confirm(
                  'Confirmer la modification de ce service et de son tarif pour les futures demandes ?',
                )
              )
                return;
              void a.run(async () => {
                const { id: _id, ...v } = selected;
                await api('/admin/services/' + selected.id, 'PATCH', {
                  name: v.name,
                  description: v.description,
                  category: v.category,
                  skills: v.skills,
                  durationMinutes: v.durationMinutes,
                  price: price === '' ? null : Number(price),
                  active: v.active,
                  confirm: true,
                });
                setSelected(null);
                await r.refresh();
              });
            }}
          >
            <Feedback action={a} />
            <label className="field">
              <span>Nom du service</span>
              <input
                required
                value={selected.name}
                onChange={(e) => setSelected({ ...selected, name: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Description</span>
              <textarea
                required
                value={selected.description}
                onChange={(e) => setSelected({ ...selected, description: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Tarif XOF (vide = sur devis)</span>
              <input
                type="number"
                min="0"
                max="10000000"
                step="1"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Durée prévue (minutes)</span>
              <input
                type="number"
                required
                min="15"
                max="480"
                value={selected.durationMinutes}
                onChange={(e) => setSelected({ ...selected, durationMinutes: Number(e.target.value) })}
              />
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                checked={selected.active}
                onChange={(e) => setSelected({ ...selected, active: e.target.checked })}
              />
              <span>Service proposé aux patients</span>
            </label>
            <button className="btn" disabled={a.busy}>
              Enregistrer les modifications
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function AuditPanel() {
  const [page, setPage] = useState(1),
    r = useResource<{ items: Audit[]; total: number; page: number; pageSize: number }>(
      '/admin/audit?page=' + page,
      { items: [], total: 0, page: 1, pageSize: 25 },
    );
  return (
    <div className="panel">
      <h3>Journal d’audit</h3>
      <p className="small muted">Actions sensibles tracées, sans contenu médical ni jeton de session.</p>
      {r.error && (
        <div className="alert" role="alert">
          {r.error}
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date (Bénin)</th>
              <th>Action</th>
              <th>Acteur</th>
              <th>Ressource</th>
            </tr>
          </thead>
          <tbody>
            {r.data.items.map((v) => (
              <tr key={v.id}>
                <td>{localDate(v.createdAt)}</td>
                <td>{v.action}</td>
                <td>{v.actorId?.slice(0, 8) ?? 'Système'}</td>
                <td>{v.resourceId?.slice(0, 8) ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={r.data.total} size={25} onPage={setPage} />
    </div>
  );
}
