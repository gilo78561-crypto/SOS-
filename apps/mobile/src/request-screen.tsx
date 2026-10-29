import { useState } from 'react';
import { View, Text, Pressable, Switch, Alert } from 'react-native';
import * as Location from 'expo-location';
import { type Service, type Beneficiary, type Care, careSchema, money, localDate } from '@sos/contracts';
import { request } from './api';
import { useData, useTask } from './hooks';
import { Button, Field, Heading, Card, Notice, Busy, Icon, s, colors } from './ui';
export function RequestScreen({
  initialService,
  onDone,
}: {
  initialService?: string;
  onDone: (c: Care) => void;
}) {
  const services = useData<Service[]>('/services', []),
    beneficiaries = useData<Beneficiary[]>('/beneficiaries', []),
    zones = useData<{ name: string }[]>('/zones', []),
    a = useTask(),
    [step, setStep] = useState(0),
    [geo, setGeo] = useState(''),
    [f, setF] = useState({
      serviceId: initialService ?? '',
      beneficiaryId: '',
      zone: 'Cotonou',
      address: '',
      date: new Date(Date.now() + 25 * 3600000).toISOString().slice(0, 10),
      time: '10:00',
      description: '',
      urgent: false,
      consent: false,
      latitude: null as number | null,
      longitude: null as number | null,
    });
  const update = (k: string, v: string | boolean | number | null) => setF((p) => ({ ...p, [k]: v }));
  const service = services.data.find((s) => s.id === f.serviceId);
  async function locate() {
    Alert.alert(
      'Ajouter votre position ?',
      'Votre position servira uniquement à préciser le point d’intervention. Vous pouvez continuer avec une adresse manuelle.',
      [
        { text: 'Saisie manuelle', style: 'cancel' },
        {
          text: 'Autoriser',
          onPress: () => {
            void a.run(async () => {
              const perm = await Location.requestForegroundPermissionsAsync();
              if (perm.status !== 'granted') {
                setGeo('Autorisation refusée. Continuez avec votre adresse.');
                return;
              }
              const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
              setF((v) => ({ ...v, latitude: p.coords.latitude, longitude: p.coords.longitude }));
              setGeo('Position ajoutée. Vérifiez également votre adresse.');
            });
          },
        },
      ],
    );
  }
  async function next() {
    a.setError('');
    if (step === 0) {
      if (!f.serviceId) {
        a.setError('Choisissez un service.');
        return;
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      if (f.address.trim().length < 5 || f.description.trim().length < 5) {
        a.setError('Indiquez une adresse et un besoin d’au moins 5 caractères.');
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date) || !/^\d{2}:\d{2}$/.test(f.time)) {
        a.setError('Vérifiez la date (AAAA-MM-JJ) et l’heure (HH:MM).');
        return;
      }
      if (!Number.isFinite(new Date(f.date + 'T' + f.time + ':00+01:00').getTime())) {
        a.setError('Cette date ou cette heure n’est pas valide.');
        return;
      }
      setStep(2);
      return;
    }
    await a.run(async () => {
      const { date, time, ...values } = f;
      const input = careSchema.parse({
        ...values,
        startAt: new Date(date + 'T' + time + ':00+01:00').toISOString(),
        beneficiaryId: f.beneficiaryId || null,
      });
      const c = await request<Care>('/cares', 'POST', input);
      onDone(c);
    });
  }
  if (services.loading) return <Busy />;
  return (
    <>
      <Heading
        title="Organiser votre soin"
        subtitle={'Étape ' + (step + 1) + ' sur 3 · La disponibilité reste à confirmer.'}
      />
      {(a.error || services.error) && <Notice error text={a.error || services.error} />}
      {step === 0 && (
        <>
          <Text style={s.h3}>De quoi avez-vous besoin ?</Text>
          {services.data.map((v) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: f.serviceId === v.id }}
              key={v.id}
              onPress={() => update('serviceId', v.id)}
              android_ripple={{ color: colors.soft }}
              style={[s.card, { borderColor: f.serviceId === v.id ? colors.primary : colors.border }]}
            >
              <View style={s.between}>
                <Icon name={v.category === 'video' ? 'video-outline' : 'stethoscope'} />
                <Text style={s.link}>{money(v.price)}</Text>
              </View>
              <Text style={[s.h3, { marginTop: 15 }]}>{v.name}</Text>
              <Text style={s.caption}>{v.description}</Text>
            </Pressable>
          ))}
        </>
      )}
      {step === 1 && (
        <>
          <Card>
            <Text style={s.h3}>Pour qui ?</Text>
            <Button
              outline={f.beneficiaryId !== ''}
              title="Moi-même"
              onPress={() => update('beneficiaryId', '')}
            />
            {beneficiaries.data.map((b) => (
              <Button
                key={b.id}
                outline={f.beneficiaryId !== b.id}
                title={b.name + ' · ' + b.relationship}
                onPress={() => update('beneficiaryId', b.id)}
              />
            ))}
          </Card>
          <Card>
            <Text style={s.h3}>À quelle adresse ?</Text>
            <Text style={[s.label, { marginBottom: 10 }]}>Zone desservie</Text>
            <View style={{ gap: 7, marginBottom: 20 }}>
              {zones.data.map((z) => (
                <Button
                  title={z.name}
                  key={z.name}
                  outline={f.zone !== z.name}
                  onPress={() => update('zone', z.name)}
                />
              ))}
            </View>
            <Field
              label="Adresse et repère"
              value={f.address}
              onChangeText={(v) => update('address', v)}
              maxLength={400}
              placeholder="Quartier, rue, repère utile…"
            />
            <Button
              title="Ajouter ma position (facultatif)"
              icon="map-marker-outline"
              outline
              onPress={locate}
              disabled={a.busy}
            />
            {!!geo && <Text style={s.caption}>{geo}</Text>}
          </Card>
          <Card>
            <Text style={s.h3}>Le créneau souhaité</Text>
            <Field
              label="Date (AAAA-MM-JJ)"
              value={f.date}
              onChangeText={(v) => update('date', v)}
              placeholder="2026-10-28"
              maxLength={10}
            />
            <Field
              label="Heure au Bénin (HH:MM)"
              value={f.time}
              onChangeText={(v) => update('time', v)}
              placeholder="10:00"
              maxLength={5}
            />
            <Field
              label="Décrivez votre besoin"
              multiline
              value={f.description}
              onChangeText={(v) => update('description', v)}
              maxLength={2000}
            />
            <View style={s.row}>
              <Switch
                value={f.urgent}
                onValueChange={(v) => update('urgent', v)}
                accessibilityLabel="Demander un rappel rapide"
              />
              <Text style={[s.caption, { flex: 1 }]}>
                Je souhaite être contacté rapidement par la coordination.
              </Text>
            </View>
          </Card>
          <Notice text="En cas de danger immédiat, contactez les services d’urgence locaux. Une demande ne garantit pas une intervention immédiate." />
        </>
      )}
      {step === 2 && (
        <>
          <Card>
            <Text style={s.h2}>{service?.name}</Text>
            <Text style={s.body}>
              {beneficiaries.data.find((b) => b.id === f.beneficiaryId)?.name ?? 'Moi-même'}
            </Text>
            <Text style={s.body}>
              {f.address} · {f.zone}
            </Text>
            <Text style={s.body}>
              {localDate(new Date(f.date + 'T' + f.time + ':00+01:00').toISOString())}
            </Text>
            <View style={s.divider} />
            <Text style={s.body}>{f.description}</Text>
            <Text style={[s.h2, { marginTop: 20, color: colors.primary }]}>
              {money(service?.price ?? null)}
            </Text>
            <Text style={s.caption}>Estimation à confirmer. Le paiement intervient après les soins.</Text>
          </Card>
          <View style={[s.row, { marginBottom: 20 }]}>
            <Switch
              value={f.consent}
              onValueChange={(v) => update('consent', v)}
              accessibilityLabel="Confirmer mon autorisation et mon consentement"
            />
            <Text style={[s.caption, { flex: 1 }]}>
              Je suis autorisé à faire cette demande et j’accepte l’utilisation des informations nécessaires à
              la prise en charge.
            </Text>
          </View>
        </>
      )}
      <Button
        title={a.busy ? 'Envoi…' : step === 2 ? 'Confirmer ma demande' : 'Continuer'}
        icon="arrow-right"
        onPress={next}
        disabled={a.busy || !services.data.length}
      />
      {step > 0 && (
        <Button
          outline
          title="Revenir à l’étape précédente"
          onPress={() => setStep(step - 1)}
          disabled={a.busy}
        />
      )}
    </>
  );
}
