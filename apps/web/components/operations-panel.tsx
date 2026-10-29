'use client';
import { useState } from 'react';
import { type User, money, localDate } from '@sos/contracts';
import { api } from '../lib/api';
import { useAction, useResource } from '../lib/hooks';
import { Feedback } from './personal-panels';
import { Empty } from './workspace-ui';
export function OperationsPanel({ user }: { user: User }) {
  const r = useResource<Record<string, string>>('/operations/settings', {}),
    a = useAction(),
    [response, setResponse] = useState('30'),
    [retention, setRetention] = useState('365');
  return (
    <>
      <Feedback action={a} extra={r.error} />
      <div className="panel">
        <h3>Propositions sans réponse</h3>
        <p className="small muted">
          Délai actuel : {r.data.assignmentResponseMinutes ?? '30'} minutes. Les missions acceptées restent
          protégées.
        </p>
        <button
          className="btn btn-outline"
          disabled={a.busy}
          onClick={() =>
            a.run(async () => {
              const v = await api<{ released: number }>('/operations/release-expired', 'POST');
              window.alert(v.released + ' proposition(s) remise(s) en recherche.');
            }, 'Relance enregistrée et tracée.')
          }
        >
          Relancer les propositions expirées
        </button>
        <p className="small muted">
          Les notifications externes sont envoyées uniquement avec consentement et prestataire configuré.
        </p>
        <button
          className="btn btn-outline"
          disabled={a.busy}
          onClick={() =>
            a.run(async () => {
              const v = await api<{ sent: number; blocked: number }>('/notifications/dispatch', 'POST');
              window.alert(v.sent + ' envoi(s) accepté(s), ' + v.blocked + ' bloqué(s) ou non configuré(s).');
            }, 'Traitement des notifications terminé.')
          }
        >
          Traiter la file de notifications
        </button>
      </div>
      {user.role === 'admin' && (
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            if (!window.confirm('Confirmer les paramètres de coordination ?')) return;
            void a.run(async () => {
              await api('/operations/settings', 'PATCH', {
                assignmentResponseMinutes: Number(response),
                retentionReviewDays: Number(retention),
                confirm: true,
              });
              await r.refresh();
            });
          }}
        >
          <h3>Paramètres d’exploitation</h3>
          <label className="field">
            <span>Délai de réponse aux missions (minutes)</span>
            <input
              required
              type="number"
              min="5"
              max="240"
              value={response}
              onChange={(e) => setResponse(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Durée avant revue de conservation (jours)</span>
            <input
              required
              type="number"
              min="30"
              max="3650"
              value={retention}
              onChange={(e) => setRetention(e.target.value)}
            />
          </label>
          <p className="notice">
            Ce paramètre organise une revue manuelle. Aucune suppression automatique de dossier médical n’est
            effectuée sans politique validée.
          </p>
          <button className="btn" disabled={a.busy}>
            Confirmer les paramètres
          </button>
        </form>
      )}
    </>
  );
}
export function EarningsPanel() {
  const r = useResource<{
    items: {
      careId: string;
      serviceName: string;
      startAt: string;
      invoicedAmount: number | null;
      invoiceStatus: string | null;
    }[];
    totalInvoiced: number;
    notice: string;
  }>('/professional/earnings', { items: [], totalInvoiced: 0, notice: '' });
  return (
    <div className="panel">
      <h3>Activité des missions terminées</h3>
      {r.error && <div className="alert">{r.error}</div>}
      <p className="notice">{r.data.notice || 'Les montants concernent les factures de vos missions.'}</p>
      <h2>{money(r.data.totalInvoiced)}</h2>
      <p className="small muted">Montant facturé, avant répartition contractuelle.</p>
      {r.data.items.length === 0 ? (
        <Empty
          title="Aucune mission terminée"
          text="Les factures de vos missions terminées apparaîtront ici."
        />
      ) : (
        r.data.items.map((i) => (
          <div key={i.careId} className="record-card">
            <h3>{i.serviceName}</h3>
            <p>
              {localDate(i.startAt)} · {money(i.invoicedAmount)} ·{' '}
              {i.invoiceStatus === 'paid'
                ? 'Facture réglée'
                : i.invoiceStatus === 'refunded'
                  ? 'Facture remboursée'
                  : 'Facture à régler'}
            </p>
          </div>
        ))
      )}
    </div>
  );
}
