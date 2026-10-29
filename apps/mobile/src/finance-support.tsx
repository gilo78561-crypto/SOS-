import { useRef, useState } from 'react';
import { Text, View, Alert, Linking } from 'react-native';
import { type User, type Invoice, type Payment, type Ticket, money, localDate } from '@sos/contracts';
import { request } from './api';
import { useData, useTask } from './hooks';
import { Button, Field, Heading, Card, Notice, Empty, s, colors } from './ui';
export function PaymentsScreen({ user, demo }: { user: User; demo: boolean }) {
  const inv = useData<Invoice[]>('/invoices', []),
    pay = useData<Payment[]>('/payments', []),
    a = useTask(),
    [provider, setProvider] = useState('mtn'),
    [phone, setPhone] = useState(user.phone),
    keys = useRef<Record<string, string>>({});
  async function refresh() {
    await Promise.all([inv.refresh(), pay.refresh()]);
  }
  return (
    <>
      <Heading title="Paiements et reçus" subtitle="Le paiement intervient après les soins terminés." />
      {(a.error || inv.error || pay.error) && <Notice error text={a.error || inv.error || pay.error} />}{' '}
      {demo && <Notice text="Mode de démonstration : aucun compte Mobile Money ne sera débité." />}
      {user.role === 'client' && (
        <Card>
          <Text style={s.h3}>Votre moyen de paiement</Text>
          {[
            ['mtn', 'MTN Mobile Money'],
            ['moov', 'Moov Money'],
            ['celtiis', 'Celtiis Cash'],
          ].map(([v, label]) => (
            <Button key={v} title={label} outline={provider !== v} onPress={() => setProvider(v)} />
          ))}
          <Field
            label="Numéro Mobile Money"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            hint="+22901 suivi de 8 chiffres. Aucun PIN ne sera demandé."
          />
        </Card>
      )}
      {inv.data.length === 0 ? (
        <Empty title="Aucune facture" text="Votre facture apparaît après la confirmation de fin des soins." />
      ) : (
        inv.data.map((i) => (
          <Card key={i.id}>
            <View style={s.between}>
              <Text style={s.h2}>{money(i.amount)}</Text>
              <View style={s.pill}>
                <Text style={s.pillText}>
                  {i.status === 'paid' ? 'Réglée' : i.status === 'refunded' ? 'Remboursée' : 'À régler'}
                </Text>
              </View>
            </View>
            <Text style={s.caption}>
              Facture {i.id.slice(0, 8).toUpperCase()} · {localDate(i.createdAt)}
            </Text>
            {i.status === 'due' && user.role === 'client' && (
              <Button
                title="Initier le paiement"
                disabled={a.busy}
                onPress={() =>
                  a.run(async () => {
                    keys.current[i.id] ??=
                      Date.now().toString(36) + '_' + Math.random().toString(36).slice(2) + '_' + i.id;
                    await request(
                      '/invoices/' + i.id + '/pay',
                      'POST',
                      { provider, phone },
                      { 'Idempotency-Key': keys.current[i.id] },
                    );
                    await refresh();
                  })
                }
              />
            )}
          </Card>
        ))
      )}
      <Text style={[s.h3, { marginTop: 20 }]}>Historique des paiements</Text>
      {pay.data.map((p) => (
        <Card key={p.id}>
          <Text style={s.h3}>
            {money(p.amount)} · {p.provider.toUpperCase()}
          </Text>
          <Text style={s.body}>
            {
              {
                pending: 'En attente',
                succeeded: 'Confirmé',
                failed: 'Échoué',
                expired: 'Expiré',
                refunded: 'Remboursé',
              }[p.status]
            }
          </Text>
          <Text selectable style={s.caption}>
            Référence : {p.id}
          </Text>
          {p.simulated && <Notice text="SIMULATION — aucun transfert d’argent." />}
          {p.status === 'pending' && (
            <>
              {p.checkoutUrl && (
                <Button
                  title="Ouvrir le paiement sécurisé"
                  icon="open-in-new"
                  onPress={() => {
                    void Linking.openURL(p.checkoutUrl!);
                  }}
                />
              )}
              {p.simulated && demo ? (
                <Button
                  outline
                  title="Simuler un succès (démo)"
                  disabled={a.busy}
                  onPress={() =>
                    Alert.alert(
                      'Paiement fictif',
                      'Enregistrer un succès simulé ? Aucun argent ne sera transféré.',
                      [
                        { text: 'Retour', style: 'cancel' },
                        {
                          text: 'Simuler',
                          onPress: () => {
                            void a.run(async () => {
                              await request('/payments/' + p.id + '/simulate', 'POST', {
                                status: 'succeeded',
                                confirm: true,
                              });
                              await refresh();
                            });
                          },
                        },
                      ],
                    )
                  }
                />
              ) : (
                <Button
                  outline
                  title="Vérifier le statut auprès du prestataire"
                  disabled={a.busy}
                  onPress={() =>
                    a.run(async () => {
                      await request('/payments/' + p.id + '/reconcile', 'POST');
                      await refresh();
                    })
                  }
                />
              )}
            </>
          )}
          {p.status === 'succeeded' && (
            <View style={{ marginTop: 16 }}>
              <Text style={s.label}>Reçu de paiement</Text>
              <Text style={s.caption}>Facture : {p.invoiceId}</Text>
              <Text style={s.caption}>Date : {localDate(p.createdAt)}</Text>
              <Text style={s.caption}>
                {p.simulated
                  ? 'Reçu fictif sans valeur financière.'
                  : 'Paiement confirmé auprès du prestataire.'}
              </Text>
            </View>
          )}
        </Card>
      ))}
      <Button outline title="Actualiser factures et paiements" onPress={refresh} />
    </>
  );
}
export function AssistantScreen() {
  const a = useTask(),
    [message, setMessage] = useState(''),
    [chat, setChat] = useState<{ role: string; text: string }[]>([
      {
        role: 'assistant',
        text: 'Je peux expliquer les services et le fonctionnement de SOS DOCTEURS. Pour un avis sur des symptômes ou un traitement, adressez-vous à un professionnel.',
      },
    ]);
  async function send(text: string) {
    if (text.trim().length < 2) return;
    setChat((c) => [...c, { role: 'user', text }]);
    setMessage('');
    await a.run(async () => {
      const r = await request<{ answer: string; mode: string }>('/assistant', 'POST', { message: text });
      setChat((c) => [
        ...c,
        {
          role: 'assistant',
          text: r.answer + (r.mode === 'sans-ia' ? '\nGuide local · sans IA externe' : ''),
        },
      ]);
    });
  }
  return (
    <>
      <Heading title="Votre guide santé" subtitle="Des informations, aucun diagnostic ni prescription." />
      <Notice text="En cas de danger immédiat, contactez les services d’urgence locaux. N’attendez pas une réponse de l’assistant. N’ajoutez pas de données identifiantes." />{' '}
      {a.error && <Notice error text={a.error} />}
      <View accessibilityLiveRegion="polite">
        {chat.map((m, i) => (
          <View
            key={i}
            style={[
              s.card,
              {
                backgroundColor: m.role === 'user' ? colors.soft : colors.white,
                marginLeft: m.role === 'user' ? 28 : 0,
                marginRight: m.role === 'assistant' ? 15 : 0,
              },
            ]}
          >
            <Text style={s.body}>{m.text}</Text>
          </View>
        ))}
      </View>
      {['Quels services proposez-vous ?', 'Comment payer ?'].map((q) => (
        <Button key={q} outline title={q} onPress={() => send(q)} disabled={a.busy} />
      ))}
      <Field label="Votre question" value={message} onChangeText={setMessage} multiline maxLength={1500} />
      <Button
        title={a.busy ? 'Réponse en cours…' : 'Envoyer ma question'}
        icon="send-outline"
        onPress={() => send(message)}
        disabled={a.busy}
      />
    </>
  );
}
export function SupportScreen({ user }: { user: User }) {
  const r = useData<Ticket[]>('/tickets', []),
    a = useTask(),
    [subject, setSubject] = useState(''),
    [message, setMessage] = useState(''),
    [replyId, setReplyId] = useState(''),
    [reply, setReply] = useState(''),
    ops = ['admin', 'operator'].includes(user.role);
  return (
    <>
      <Heading title="Aide et support" subtitle="Une question d’organisation, une réclamation ?" />
      {(a.error || r.error) && <Notice error text={a.error || r.error} />}
      <Card>
        <Field label="Objet" value={subject} onChangeText={setSubject} maxLength={120} />
        <Field label="Votre message" multiline value={message} onChangeText={setMessage} maxLength={2000} />
        <Button
          title="Envoyer le message"
          disabled={a.busy}
          onPress={() =>
            a.run(async () => {
              await request('/tickets', 'POST', { subject, message });
              setSubject('');
              setMessage('');
              await r.refresh();
            })
          }
        />
      </Card>
      {r.data.map((t) => (
        <Card key={t.id}>
          <Text style={s.h3}>{t.subject}</Text>
          <Text style={s.body}>{t.message}</Text>
          <Text style={s.caption}>
            {t.status === 'resolved' ? 'Résolu' : 'Ouvert'} · {localDate(t.createdAt)}
          </Text>
          {t.response && (
            <View style={{ backgroundColor: colors.soft, padding: 15, borderRadius: 10, marginTop: 15 }}>
              <Text style={s.label}>Réponse de la coordination</Text>
              <Text style={s.body}>{t.response}</Text>
            </View>
          )}
          {ops && (
            <Button
              title="Répondre"
              outline
              onPress={() => {
                setReplyId(t.id);
                setReply(t.response ?? '');
              }}
            />
          )}
          {replyId === t.id && (
            <>
              <Field label="Réponse" multiline value={reply} onChangeText={setReply} />
              <Button
                title="Envoyer et résoudre"
                disabled={a.busy}
                onPress={() =>
                  a.run(async () => {
                    await request('/tickets/' + t.id, 'PATCH', { response: reply, status: 'resolved' });
                    setReplyId('');
                    await r.refresh();
                  })
                }
              />
            </>
          )}
        </Card>
      ))}
    </>
  );
}
