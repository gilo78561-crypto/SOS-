'use client';
import { useRef, useState } from 'react';
import { CreditCard, ArrowUpRight, Printer, Send, Sparkles, MessageCircle } from 'lucide-react';
import { type User, type Invoice, type Payment, type Ticket, money, localDate } from '@sos/contracts';
import { api } from '../lib/api';
import { useAction, useResource } from '../lib/hooks';
import { Feedback } from './personal-panels';
import { Empty, Modal } from './workspace-ui';
export function PaymentsPanel({ user, demo }: { user: User; demo: boolean }) {
  const invoices = useResource<Invoice[]>('/invoices', []),
    payments = useResource<Payment[]>('/payments', []),
    a = useAction(),
    [provider, setProvider] = useState('mtn'),
    [phone, setPhone] = useState(user.phone),
    [receipt, setReceipt] = useState<Invoice | null>(null),
    keys = useRef<Record<string, string>>({});
  async function refresh() {
    await Promise.all([invoices.refresh(), payments.refresh()]);
  }
  return (
    <>
      <Feedback action={a} extra={invoices.error || payments.error} />
      {demo && (
        <div className="notice" style={{ marginBottom: 20 }}>
          Démonstration : les paiements fictifs ne débitent aucun compte Mobile Money. Un succès de simulation
          est identifié comme tel.
        </div>
      )}
      {user.role === 'client' && (
        <div className="panel">
          <div className="panel-heading">
            <h2>Votre moyen de paiement</h2>
            <CreditCard size={22} />
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Opérateur</span>
              <select value={provider} onChange={(e) => setProvider(e.target.value)}>
                <option value="mtn">MTN Mobile Money</option>
                <option value="moov">Moov Money</option>
                <option value="celtiis">Celtiis Cash</option>
              </select>
            </label>
            <label className="field">
              <span>Numéro Mobile Money</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                pattern="\+22901[0-9]{8}"
                required
              />
            </label>
          </div>
          <p className="small muted">Votre PIN ne sera jamais demandé dans SOS DOCTEURS.</p>
        </div>
      )}
      <div className="panel">
        <h3>Factures après les soins</h3>
        {!invoices.data.length ? (
          <Empty
            title="Aucune facture à régler"
            text="Une facture est créée lorsque le professionnel confirme la fin des soins."
          />
        ) : (
          invoices.data.map((i) => {
            const p = payments.data.find((p) => p.invoiceId === i.id && p.status === 'pending');
            return (
              <article className="record-card" key={i.id}>
                <div className="record-head">
                  <div>
                    <strong>{money(i.amount)}</strong>
                    <p>
                      Facture {i.id.slice(0, 8).toUpperCase()} · {localDate(i.createdAt)}
                    </p>
                  </div>
                  <span className={'pill' + (i.status === 'due' ? ' pill-warn' : '')}>
                    {i.status === 'paid' ? 'Réglée' : i.status === 'refunded' ? 'Remboursée' : 'À régler'}
                  </span>
                </div>
                <div className="actions">
                  {i.status === 'due' && user.role === 'client' && (
                    <button
                      className="btn btn-sm"
                      disabled={a.busy}
                      onClick={() =>
                        a.run(async () => {
                          keys.current[i.id] ??= window.crypto.randomUUID();
                          await api(
                            '/invoices/' + i.id + '/pay',
                            'POST',
                            { provider, phone },
                            { 'Idempotency-Key': keys.current[i.id] },
                          );
                          await refresh();
                        }, 'Paiement initialisé. La confirmation dépend du prestataire.')
                      }
                    >
                      {p ? 'Retrouver le paiement en attente' : 'Choisir ce moyen et payer'}
                    </button>
                  )}
                  {i.status !== 'due' && (
                    <button className="btn btn-outline btn-sm" onClick={() => setReceipt(i)}>
                      <Printer size={15} /> Voir le reçu
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
      <div className="panel">
        <h3>Historique et rapprochement</h3>
        {payments.data.length === 0 ? (
          <p className="small muted">Aucun paiement pour le moment.</p>
        ) : (
          payments.data.map((p) => (
            <article className="record-card" key={p.id}>
              <div className="record-head">
                <div>
                  <strong>
                    {money(p.amount)} · {p.provider.toUpperCase()}
                  </strong>
                  <p>
                    Réf. {p.id.slice(0, 8).toUpperCase()} · {localDate(p.createdAt)}
                  </p>
                  {p.simulated && <span className="pill pill-warn">SIMULATION — aucun débit</span>}
                </div>
                <span className="pill">
                  {
                    {
                      pending: 'En attente',
                      succeeded: 'Confirmé',
                      failed: 'Échoué',
                      expired: 'Expiré',
                      refunded: 'Remboursé',
                    }[p.status]
                  }
                </span>
              </div>
              {p.status === 'pending' && (
                <div className="actions">
                  {p.checkoutUrl && (
                    <a className="btn btn-sm" href={p.checkoutUrl} target="_blank" rel="noreferrer">
                      Ouvrir le paiement sécurisé <ArrowUpRight size={15} />
                    </a>
                  )}
                  {p.simulated && demo ? (
                    <>
                      <button
                        className="btn btn-outline btn-sm"
                        disabled={a.busy}
                        onClick={() =>
                          a.run(async () => {
                            await api('/payments/' + p.id + '/simulate', 'POST', {
                              status: 'succeeded',
                              confirm: true,
                            });
                            await refresh();
                          }, 'Succès fictif enregistré. Aucun argent transféré.')
                        }
                      >
                        Simuler un succès (démo)
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        disabled={a.busy}
                        onClick={() =>
                          a.run(async () => {
                            await api('/payments/' + p.id + '/simulate', 'POST', {
                              status: 'failed',
                              confirm: true,
                            });
                            await refresh();
                          })
                        }
                      >
                        Simuler un échec
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={a.busy}
                      onClick={() =>
                        a.run(async () => {
                          await api('/payments/' + p.id + '/reconcile', 'POST');
                          await refresh();
                        }, 'Statut vérifié auprès du prestataire.')
                      }
                    >
                      Vérifier le statut
                    </button>
                  )}
                </div>
              )}
              {p.status === 'succeeded' && user.role === 'admin' && (
                <button
                  className="btn btn-outline btn-sm"
                  disabled={a.busy}
                  onClick={() => {
                    const reason = window.prompt('Motif du remboursement intégral (au moins 5 caractères)');
                    if (
                      !reason ||
                      !window.confirm(
                        'Confirmer la demande de remboursement intégral de ' + money(p.amount) + ' ?',
                      )
                    )
                      return;
                    void a.run(async () => {
                      const result = await api<{ status: string }>('/payments/' + p.id + '/refund', 'POST', {
                        reason,
                        confirm: true,
                      });
                      await refresh();
                      if (result.status === 'manual_review')
                        window.alert(
                          'Remboursement enregistré pour traitement manuel. Aucun transfert réel annoncé comme terminé.',
                        );
                    }, 'Demande de remboursement enregistrée.');
                  }}
                >
                  Demander un remboursement
                </button>
              )}
            </article>
          ))
        )}
      </div>
      {receipt && (
        <Modal title="Reçu de paiement" onClose={() => setReceipt(null)}>
          <p className="eyebrow">SOS DOCTEURS · BÉNIN</p>
          <h2 style={{ fontSize: 28 }}>{money(receipt.amount)}</h2>
          <p>Facture : {receipt.id}</p>
          <p>Date : {localDate(receipt.createdAt)}</p>
          <p>État : {receipt.status === 'paid' ? 'Réglée' : 'Remboursée'}</p>
          {payments.data.some((p) => p.invoiceId === receipt.id && p.simulated) && (
            <div className="notice">REÇU DE DÉMONSTRATION — AUCUNE VALEUR FINANCIÈRE</div>
          )}
          <p className="small muted">Référence de soins : {receipt.careId}</p>
          <button className="btn" onClick={() => window.print()}>
            <Printer size={16} /> Imprimer
          </button>
        </Modal>
      )}
    </>
  );
}
export function AssistantPanel() {
  const a = useAction(),
    [message, setMessage] = useState(''),
    [chat, setChat] = useState<{ role: 'user' | 'assistant'; text: string; urgent?: boolean }[]>([
      {
        role: 'assistant',
        text: 'Bonjour. Je peux expliquer les services, les paiements et le fonctionnement de SOS DOCTEURS. Pour vos symptômes ou votre traitement, demandez un avis à un professionnel.',
      },
    ]);
  async function send(text: string) {
    if (!text.trim()) return;
    setMessage('');
    setChat((c) => [...c, { role: 'user', text }]);
    await a.run(async () => {
      const r = await api<{ answer: string; mode: string; urgent: boolean }>('/assistant', 'POST', {
        message: text,
      });
      setChat((c) => [
        ...c,
        {
          role: 'assistant',
          text: r.answer + (r.mode === 'sans-ia' ? '\nGuide local · sans IA externe' : ''),
          urgent: r.urgent,
        },
      ]);
    }, '');
  }
  return (
    <div className="panel">
      <div className="panel-heading">
        <div>
          <h2>Votre guide SOS DOCTEURS</h2>
          <p>Informations générales · aucune prescription ni diagnostic</p>
        </div>
        <Sparkles color="#006b45" />
      </div>
      <div className="notice">
        En cas de danger immédiat, contacte les services d’urgence locaux. Cet assistant ne doit pas retarder
        une prise en charge urgente. N’ajoute pas de données identifiantes.
      </div>
      <Feedback action={a} />
      <div className="assistant-chat" aria-live="polite">
        {chat.map((m, i) => (
          <div key={i} className={'chat-bubble ' + m.role + (m.urgent ? ' alert' : '')}>
            {m.text}
          </div>
        ))}
      </div>
      <div className="assistant-prompts">
        {['Quels services proposez-vous ?', 'Comment payer ?', 'Mes données sont-elles privées ?'].map(
          (q) => (
            <button className="btn btn-outline btn-sm" disabled={a.busy} key={q} onClick={() => send(q)}>
              {q}
            </button>
          ),
        )}
      </div>
      <form
        className="assistant-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send(message);
        }}
      >
        <label className="field">
          <span>Votre question</span>
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1500}
            minLength={2}
            required
            placeholder="Posez une question sur le service…"
          />
        </label>
        <button className="btn" disabled={a.busy} aria-label="Envoyer la question">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
export function SupportPanel({ user }: { user: User }) {
  const r = useResource<Ticket[]>('/tickets', []),
    a = useAction(),
    [f, setF] = useState({ subject: '', message: '' });
  const ops = ['admin', 'operator'].includes(user.role);
  return (
    <>
      <Feedback action={a} extra={r.error} />
      <div className="panel">
        <div className="panel-heading">
          <h2>Une équipe à votre écoute</h2>
          <MessageCircle size={23} />
        </div>
        <p className="small muted">
          Pour une question d’organisation ou une réclamation. Pour une situation urgente, contactez les
          services d’urgence locaux.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void a.run(async () => {
              await api('/tickets', 'POST', f);
              setF({ subject: '', message: '' });
              await r.refresh();
            }, 'Votre message a été enregistré.');
          }}
        >
          <label className="field">
            <span>Objet</span>
            <input
              required
              minLength={3}
              maxLength={120}
              value={f.subject}
              onChange={(e) => setF({ ...f, subject: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Message</span>
            <textarea
              required
              minLength={5}
              maxLength={2000}
              value={f.message}
              onChange={(e) => setF({ ...f, message: e.target.value })}
            />
          </label>
          <button className="btn btn-sm" disabled={a.busy}>
            Envoyer le message
          </button>
        </form>
      </div>
      <div className="panel">
        <h3>{ops ? 'Messages à traiter' : 'Vos échanges'}</h3>
        {r.data.length === 0 ? (
          <Empty title="Aucun message" text="Vous retrouverez ici les réponses à vos demandes." />
        ) : (
          r.data.map((t) => (
            <article className="record-card" key={t.id}>
              <span className="pill">{t.status === 'resolved' ? 'Résolu' : 'Ouvert'}</span>
              <h3 style={{ marginTop: 12 }}>{t.subject}</h3>
              <p>{t.message}</p>
              {t.response && (
                <div className="wizard-summary">
                  <strong className="small">Réponse de la coordination</strong>
                  <p>{t.response}</p>
                </div>
              )}
              {ops && (
                <button
                  className="btn btn-outline btn-sm"
                  disabled={a.busy}
                  onClick={() => {
                    const response = window.prompt('Réponse au demandeur :', t.response ?? '');
                    if (response)
                      void a.run(async () => {
                        await api('/tickets/' + t.id, 'PATCH', { response, status: 'resolved' });
                        await r.refresh();
                      });
                  }}
                >
                  Répondre et résoudre
                </button>
              )}
            </article>
          ))
        )}
      </div>
    </>
  );
}
