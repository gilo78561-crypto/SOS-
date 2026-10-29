import { useState } from 'react';
import { Text, View, Alert, Linking } from 'react-native';
import { type User, type Care, type CareStatus, statusLabels, money, localDate } from '@sos/contracts';
import { request } from './api';
import { useData, useTask } from './hooks';
import { Button, Field, Heading, Card, Notice, Busy, Icon, s, colors } from './ui';
type Candidate = {
  id: string;
  name: string;
  specialty: string;
  distanceKm: number | null;
  criteria: string[];
};
export function DetailScreen({ id, user, onPayments }: { id: string; user: User; onPayments: () => void }) {
  const r = useData<Care | null>('/cares/' + id, null),
    a = useTask(),
    [quote, setQuote] = useState(''),
    [candidates, setCandidates] = useState<Candidate[] | null>(null),
    [notes, setNotes] = useState<{ id: string; content: string; createdAt: string }[] | null>(null),
    [content, setContent] = useState(''),
    [video, setVideo] = useState(''),
    ops = ['admin', 'operator'].includes(user.role),
    pro = ['doctor', 'nurse'].includes(user.role);
  async function transition(status: CareStatus) {
    const execute = () => {
      void a.run(async () => {
        await request('/cares/' + id + '/transition', 'POST', { status, note: '' });
        await r.refresh();
      });
    };
    if (['cancelled', 'searching'].includes(status))
      Alert.alert(
        'Confirmer cette action ?',
        status === 'cancelled' ? 'La demande sera annulée.' : 'La mission sera remise en recherche.',
        [
          { text: 'Retour', style: 'cancel' },
          { text: 'Confirmer', onPress: execute },
        ],
      );
    else execute();
  }
  if (r.loading) return <Busy />;
  const c = r.data;
  if (!c)
    return (
      <>
        <Notice error text={r.error || 'Demande introuvable.'} />
        <Button title="Réessayer" onPress={r.refresh} />
      </>
    );
  const next: Partial<Record<CareStatus, CareStatus[]>> = {
    assigned: ['accepted', 'searching'],
    accepted: ['en_route'],
    en_route: ['arrived'],
    arrived: ['in_progress'],
    in_progress: ['completed'],
  };
  return (
    <>
      <Heading title={c.serviceName} subtitle={'Demande ' + id.slice(0, 8).toUpperCase()} />
      {(a.error || r.error) && <Notice error text={a.error || r.error} />}
      <Card>
        <View style={[s.pill, { marginBottom: 20 }]}>
          <Text style={s.pillText}>{statusLabels[c.status]}</Text>
        </View>
        <Text style={s.h3}>{c.beneficiaryName}</Text>
        <Text style={s.body}>{localDate(c.startAt)}</Text>
        <Text style={s.body}>
          {c.address} · {c.zone}
        </Text>
        <View style={s.divider} />
        <Text style={s.label}>Professionnel</Text>
        <Text style={[s.body, { marginTop: 4 }]}>{c.professionalName ?? 'À confirmer'}</Text>
        <Text style={[s.h2, { color: colors.primary, marginTop: 20 }]}>{money(c.estimate)}</Text>
        <Text style={s.caption}>Estimation confirmée par la coordination.</Text>
        <View style={s.divider} />
        <Text style={s.body}>{c.description}</Text>
        {c.latitude !== null && c.longitude !== null && (
          <Button
            outline
            title="Voir le point sur la carte"
            icon="map-marker-outline"
            onPress={() => {
              void Linking.openURL(
                'https://www.openstreetmap.org/?mlat=' +
                  c.latitude +
                  '&mlon=' +
                  c.longitude +
                  '#map=17/' +
                  c.latitude +
                  '/' +
                  c.longitude,
              );
            }}
          />
        )}
      </Card>
      {ops && !['completed', 'failed', 'cancelled'].includes(c.status) && (
        <Card>
          <Text style={s.h3}>Confirmer le devis</Text>
          <Field
            label="Montant total en XOF"
            keyboardType="number-pad"
            value={quote}
            onChangeText={setQuote}
            placeholder={c.estimate?.toString() ?? 'À définir'}
          />
          <Button
            title="Confirmer ce tarif"
            disabled={a.busy}
            onPress={() =>
              Alert.alert('Confirmer le devis', 'Enregistrer ' + quote + ' XOF pour cette demande ?', [
                { text: 'Retour', style: 'cancel' },
                {
                  text: 'Confirmer',
                  onPress: () => {
                    void a.run(async () => {
                      await request('/cares/' + id + '/quote', 'POST', {
                        amount: Number(quote),
                        confirm: true,
                      });
                      await r.refresh();
                    });
                  },
                },
              ])
            }
          />
        </Card>
      )}
      {ops && ['submitted', 'to_confirm'].includes(c.status) && (
        <Button
          title="Mettre en recherche de professionnel"
          onPress={() => transition('searching')}
          disabled={a.busy}
        />
      )}
      {ops && c.status === 'searching' && (
        <Card>
          <Text style={s.h3}>Affectation</Text>
          <Button
            outline
            title="Rechercher les professionnels éligibles"
            onPress={() =>
              a.run(async () => setCandidates(await request<Candidate[]>('/cares/' + id + '/candidates')))
            }
            disabled={a.busy}
          />
          {candidates?.length === 0 && (
            <Text style={s.body}>Aucun professionnel compatible avec ce créneau.</Text>
          )}
          {candidates?.map((p) => (
            <View key={p.id} style={{ marginTop: 20 }}>
              <Text style={s.h3}>{p.name}</Text>
              <Text style={s.caption}>
                {p.specialty}
                {p.distanceKm !== null ? ' · ' + p.distanceKm + ' km' : ''}
              </Text>
              <Text style={s.caption}>{p.criteria.join(' · ')}</Text>
              <Button
                title="Proposer la mission"
                disabled={a.busy}
                onPress={() =>
                  a.run(async () => {
                    await request('/cares/' + id + '/assign', 'POST', { professionalId: p.id });
                    await r.refresh();
                  })
                }
              />
            </View>
          ))}
        </Card>
      )}
      {pro &&
        (next[c.status] ?? []).map((status) => (
          <Button
            key={status}
            title={
              status === 'searching'
                ? 'Refuser la mission'
                : status === 'completed'
                  ? 'Confirmer les soins terminés'
                  : statusLabels[status]
            }
            outline={status === 'searching'}
            onPress={() => transition(status)}
            disabled={a.busy}
          />
        ))}
      {(ops || user.role === 'client') &&
        ['submitted', 'to_confirm', 'searching', 'assigned', 'accepted'].includes(c.status) && (
          <Button
            outline
            title="Annuler cette demande"
            onPress={() => transition('cancelled')}
            disabled={a.busy}
          />
        )}
      {c.serviceName === 'Téléconsultation' &&
        !ops &&
        ['accepted', 'en_route', 'arrived', 'in_progress'].includes(c.status) && (
          <Card>
            <Text style={s.h3}>Téléconsultation privée</Text>
            <Text style={s.caption}>
              En accédant à la salle, vous consentez à la consultation vidéo avec le prestataire configuré.
            </Text>
            <Button
              title="Accéder à la salle vidéo"
              icon="video-outline"
              onPress={() =>
                a.run(async () => {
                  const result = await request<{ joinUrl: string | null; message?: string }>(
                    '/cares/' + id + '/consultation',
                    'POST',
                    { consent: true },
                  );
                  if (result.joinUrl) await Linking.openURL(result.joinUrl);
                  else setVideo(result.message ?? 'Salle non configurée.');
                })
              }
              disabled={a.busy}
            />
            {!!video && <Notice text={video} />}
          </Card>
        )}
      <Card>
        <Text style={s.h3}>Le suivi de votre prise en charge</Text>
        {c.events?.map((e) => (
          <View
            key={e.id}
            style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
          >
            <View style={s.row}>
              <Icon name="check-circle-outline" size={18} />
              <Text style={s.label}>{statusLabels[e.status]}</Text>
            </View>
            <Text style={[s.caption, { marginTop: 6 }]}>{localDate(e.createdAt)}</Text>
            <Text style={s.caption}>{e.note}</Text>
          </View>
        ))}
      </Card>
      {c.invoice && (
        <Card>
          <Text style={s.h3}>Facture après les soins</Text>
          <Text style={s.h2}>{money(c.invoice.amount)}</Text>
          <Button title="Voir la facture et le paiement" onPress={onPayments} />
        </Card>
      )}
      {!ops && (
        <Card>
          <Text style={s.h3}>Notes de soins privées</Text>
          <Button
            outline
            title="Consulter les notes"
            disabled={a.busy}
            onPress={() => a.run(async () => setNotes(await request('/cares/' + id + '/notes')))}
          />
          {notes?.map((n) => (
            <View key={n.id} style={{ marginVertical: 12 }}>
              <Text style={s.caption}>{localDate(n.createdAt)}</Text>
              <Text style={s.body}>{n.content}</Text>
            </View>
          ))}
          {notes?.length === 0 && <Text style={s.caption}>Aucune note pour le moment.</Text>}
          {pro && ['in_progress', 'completed'].includes(c.status) && (
            <>
              <Field
                label="Note de soins"
                multiline
                value={content}
                onChangeText={setContent}
                maxLength={10000}
              />
              <Button
                title="Enregistrer la note"
                disabled={a.busy}
                onPress={() =>
                  a.run(async () => {
                    await request('/cares/' + id + '/notes', 'POST', { content });
                    setContent('');
                    setNotes(await request('/cares/' + id + '/notes'));
                  })
                }
              />
            </>
          )}
        </Card>
      )}
    </>
  );
}
