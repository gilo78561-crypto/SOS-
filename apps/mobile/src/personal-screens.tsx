import { useState, useEffect } from 'react';
import { Text, View, Switch, Alert, Linking } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import {
  type Beneficiary,
  type Availability,
  type Professional,
  type DocumentInfo,
  type User,
  type Notification,
  localDate,
  roleLabels,
} from '@sos/contracts';
import { request } from './api';
import { useData, useTask } from './hooks';
import { Button, Field, Heading, Card, Notice, Empty, s, colors } from './ui';
export function BeneficiaryScreen() {
  const r = useData<Beneficiary[]>('/beneficiaries', []),
    a = useTask(),
    [open, setOpen] = useState(false),
    [f, setF] = useState({ name: '', relationship: 'Parent', consent: false });
  return (
    <>
      <Heading title="Mes proches" subtitle="Les personnes que vous êtes autorisé à accompagner." />
      {(a.error || r.error) && <Notice error text={a.error || r.error} />}
      <Button
        title={open ? 'Fermer le formulaire' : 'Ajouter un proche'}
        outline
        icon="account-plus-outline"
        onPress={() => setOpen(!open)}
      />
      {open && (
        <Card>
          <Field
            label="Nom et prénom"
            value={f.name}
            onChangeText={(v) => setF({ ...f, name: v })}
            maxLength={100}
          />
          <Field
            label="Lien avec cette personne"
            value={f.relationship}
            onChangeText={(v) => setF({ ...f, relationship: v })}
            maxLength={50}
          />
          <View style={s.row}>
            <Switch
              accessibilityLabel="Confirmer mon autorisation"
              value={f.consent}
              onValueChange={(v) => setF({ ...f, consent: v })}
            />
            <Text style={[s.caption, { flex: 1 }]}>
              Je suis autorisé à gérer les demandes de cette personne.
            </Text>
          </View>
          <Button
            title="Enregistrer le proche"
            disabled={a.busy}
            onPress={() =>
              a.run(async () => {
                await request('/beneficiaries', 'POST', f);
                setOpen(false);
                setF({ name: '', relationship: 'Parent', consent: false });
                await r.refresh();
              })
            }
          />
        </Card>
      )}
      {r.data.length === 0 && !open ? (
        <Empty title="Votre carnet de proches" text="Ajoutez un proche pour organiser un soin en son nom." />
      ) : (
        r.data.map((b) => (
          <Card key={b.id}>
            <View style={[s.pill, { marginBottom: 12 }]}>
              <Text style={s.pillText}>{b.relationship}</Text>
            </View>
            <Text style={s.h3}>{b.name}</Text>
            <Text style={s.caption}>Autorisation de gestion confirmée.</Text>
          </Card>
        ))
      )}
    </>
  );
}
export function AvailabilityScreen() {
  const r = useData<Availability[]>('/professional/availability', []),
    a = useTask(),
    [f, setF] = useState({
      date: new Date(Date.now() + 25 * 3600000).toISOString().slice(0, 10),
      start: '08:00',
      end: '18:00',
      available: true,
    });
  return (
    <>
      <Heading
        title="Mes disponibilités"
        subtitle="Déclarez uniquement les périodes utiles à SOS DOCTEURS."
      />
      {(a.error || r.error) && <Notice error text={a.error || r.error} />}
      <Card>
        <Field label="Date (AAAA-MM-JJ)" value={f.date} onChangeText={(v) => setF({ ...f, date: v })} />
        <Field label="Début (HH:MM, Bénin)" value={f.start} onChangeText={(v) => setF({ ...f, start: v })} />
        <Field label="Fin (HH:MM, Bénin)" value={f.end} onChangeText={(v) => setF({ ...f, end: v })} />
        <View style={s.row}>
          <Switch
            accessibilityLabel="Disponible pour SOS DOCTEURS"
            value={f.available}
            onValueChange={(v) => setF({ ...f, available: v })}
            trackColor={{ true: colors.primary }}
          />
          <Text style={s.label}>{f.available ? 'Disponible' : 'Indisponible'}</Text>
        </View>
        <Button
          title="Enregistrer cette période"
          disabled={a.busy}
          onPress={() =>
            a.run(async () => {
              await request('/professional/availability', 'POST', {
                startAt: new Date(f.date + 'T' + f.start + ':00+01:00').toISOString(),
                endAt: new Date(f.date + 'T' + f.end + ':00+01:00').toISOString(),
                available: f.available,
              });
              await r.refresh();
            })
          }
        />
      </Card>
      <Notice text="Une période d’indisponibilité est prioritaire. Une mission déjà affectée doit être réorganisée avec la coordination." />
      {r.data.map((v) => (
        <Card key={v.id}>
          <Text style={s.h3}>{v.available ? 'Disponible' : 'Indisponible'}</Text>
          <Text style={s.caption}>
            {localDate(v.startAt)} → {localDate(v.endAt)}
          </Text>
        </Card>
      ))}
    </>
  );
}
export function ProfileScreen() {
  const r = useData<Professional | null>('/professional/profile', null),
    docs = useData<DocumentInfo[]>('/documents', []),
    a = useTask(),
    [f, setF] = useState({
      specialty: '',
      skills: '',
      zones: '',
      latitude: '',
      longitude: '',
      radiusKm: '30',
    });
  useEffect(() => {
    if (r.data)
      setF({
        specialty: r.data.specialty,
        skills: r.data.skills.join(', '),
        zones: r.data.zones.join(', '),
        latitude: r.data.latitude?.toString() ?? '',
        longitude: r.data.longitude?.toString() ?? '',
        radiusKm: String(r.data.radiusKm),
      });
  }, [r.data]);
  async function upload() {
    await a.run(async () => {
      const p = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'],
        copyToCacheDirectory: true,
      });
      if (p.canceled) return;
      const asset = p.assets[0],
        file = new File(asset.uri);
      try {
        if ((asset.size ?? file.size) > 5 * 1024 * 1024) throw new Error('Fichier supérieur à 5 Mo.');
        await request('/documents', 'POST', {
          name: asset.name,
          mime: asset.mimeType,
          base64: await file.base64(),
        });
        await docs.refresh();
      } finally {
        file.delete();
      }
    });
  }
  return (
    <>
      <Heading title="Mon profil professionnel" />
      {(a.error || r.error || docs.error) && <Notice error text={a.error || r.error || docs.error} />}
      <Notice text="Toute modification soumet à nouveau votre profil à la vérification. Votre position précise reste privée." />
      <Card>
        <View style={[s.pill, { marginBottom: 18 }]}>
          <Text style={s.pillText}>
            {r.data?.verification === 'approved'
              ? 'Profil vérifié'
              : r.data?.verification === 'rejected'
                ? 'Profil à corriger'
                : 'Vérification en attente'}
          </Text>
        </View>
        {r.data?.reason && <Text style={[s.caption, { marginBottom: 20 }]}>{r.data.reason}</Text>}
        <Field label="Spécialité" value={f.specialty} onChangeText={(v) => setF({ ...f, specialty: v })} />
        <Field
          label="Compétences, séparées par des virgules"
          value={f.skills}
          onChangeText={(v) => setF({ ...f, skills: v })}
          hint="consultation, nursing, sampling, ultrasound, ecg"
        />
        <Field
          label="Zones, séparées par des virgules"
          value={f.zones}
          onChangeText={(v) => setF({ ...f, zones: v })}
        />
        <Field
          label="Latitude de départ (facultative)"
          value={f.latitude}
          onChangeText={(v) => setF({ ...f, latitude: v })}
          keyboardType="decimal-pad"
        />
        <Field
          label="Longitude de départ (facultative)"
          value={f.longitude}
          onChangeText={(v) => setF({ ...f, longitude: v })}
          keyboardType="decimal-pad"
        />
        <Field
          label="Rayon d’intervention en km"
          value={f.radiusKm}
          onChangeText={(v) => setF({ ...f, radiusKm: v })}
          keyboardType="number-pad"
        />
        <Button
          title="Enregistrer et soumettre à vérification"
          disabled={a.busy}
          onPress={() =>
            a.run(async () => {
              await request('/professional/profile', 'PATCH', {
                specialty: f.specialty,
                skills: f.skills
                  .split(',')
                  .map((v) => v.trim())
                  .filter(Boolean),
                zones: f.zones
                  .split(',')
                  .map((v) => v.trim())
                  .filter(Boolean),
                latitude: f.latitude ? Number(f.latitude) : null,
                longitude: f.longitude ? Number(f.longitude) : null,
                radiusKm: Number(f.radiusKm),
              });
              await r.refresh();
            })
          }
        />
      </Card>
      <Card>
        <Text style={s.h3}>Justificatifs privés</Text>
        <Text style={s.caption}>
          PDF, JPEG ou PNG · 5 Mo maximum. Le fichier temporaire est supprimé après envoi.
        </Text>
        <Button
          title="Choisir et envoyer un justificatif"
          icon="file-upload-outline"
          onPress={upload}
          disabled={a.busy}
        />
        {docs.data.map((d) => (
          <View key={d.id} style={{ paddingVertical: 12 }}>
            <Text style={s.label}>{d.name}</Text>
            <Text style={s.caption}>{localDate(d.createdAt)}</Text>
          </View>
        ))}
      </Card>
    </>
  );
}
export function TeamScreen({ user }: { user: User }) {
  const r = useData<Professional[]>('/professionals', []),
    a = useTask(),
    [selected, setSelected] = useState<Professional | null>(null),
    [reason, setReason] = useState('');
  async function verify(decision: string) {
    if (!selected) return;
    Alert.alert(
      'Confirmer la décision',
      'Cette action est tracée. La validation suppose un contrôle effectif des justificatifs.',
      [
        { text: 'Retour', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: () => {
            void a.run(async () => {
              await request('/professionals/' + selected.id + '/verify', 'POST', {
                decision,
                reason,
                confirm: true,
              });
              setSelected(null);
              setReason('');
              await r.refresh();
            });
          },
        },
      ],
    );
  }
  return (
    <>
      <Heading title="Les professionnels" subtitle="Vérification et compétences de l’équipe." />
      {(a.error || r.error) && <Notice error text={a.error || r.error} />}
      <Button outline title="Actualiser l’équipe" onPress={r.refresh} />
      {r.data.map((p) => (
        <Card key={p.id}>
          <View style={[s.pill, { marginBottom: 12 }]}>
            <Text style={s.pillText}>
              {p.verification === 'approved'
                ? 'Vérifié'
                : p.verification === 'rejected'
                  ? 'Refusé'
                  : 'À vérifier'}
            </Text>
          </View>
          <Text style={s.h3}>{p.name}</Text>
          <Text style={s.body}>{p.specialty}</Text>
          <Text style={s.caption}>{p.skills.join(' · ')}</Text>
          <Text style={s.caption}>{p.zones.join(', ')}</Text>
          {user.role === 'admin' && (
            <Button outline title="Examiner la candidature" onPress={() => setSelected(p)} />
          )}
        </Card>
      ))}
      {selected && (
        <Card>
          <Text style={s.h3}>{selected.name}</Text>
          <Notice text="Examinez les justificatifs dans votre espace web sécurisé avant de valider. Aucun document professionnel n’est accessible publiquement." />
          <Button
            outline
            title="Ouvrir les dossiers sur le web"
            onPress={() => {
              void Linking.openURL((process.env.EXPO_PUBLIC_WEB_URL ?? 'http://10.0.2.2:3000') + '/espace');
            }}
          />
          <Field
            label="Motif et contrôles effectués"
            multiline
            value={reason}
            onChangeText={setReason}
            maxLength={500}
          />
          <Button title="Valider le professionnel" onPress={() => verify('approved')} disabled={a.busy} />
          <Button
            title="Refuser la candidature"
            outline
            onPress={() => verify('rejected')}
            disabled={a.busy}
          />
          <Button title="Fermer" outline onPress={() => setSelected(null)} />
        </Card>
      )}
    </>
  );
}
export function AccountScreen({
  user,
  navigate,
  onLogout,
}: {
  user: User;
  navigate: (route: string) => void;
  onLogout: () => void;
}) {
  const pref = useData<{ email: boolean; sms: boolean; push: boolean } | null>('/preferences', null),
    a = useTask();
  return (
    <>
      <Heading title="Mon compte" />
      <Card>
        <Text style={s.h2}>{user.name}</Text>
        <Text style={s.body}>{user.email}</Text>
        <Text style={s.body}>{user.phone}</Text>
        <View style={[s.pill, { marginTop: 14 }]}>
          <Text style={s.pillText}>{roleLabels[user.role]}</Text>
        </View>
      </Card>
      {a.error && <Notice error text={a.error} />}
      <Card>
        {user.role === 'client' && (
          <>
            <Button
              outline
              title="Paiements et reçus"
              icon="credit-card-outline"
              onPress={() => navigate('payments')}
            />
            <Button
              outline
              title="Guide santé"
              icon="chat-question-outline"
              onPress={() => navigate('assistant')}
            />
          </>
        )}
        {['doctor', 'nurse'].includes(user.role) && (
          <Button
            outline
            title="Profil et justificatifs"
            icon="account-check-outline"
            onPress={() => navigate('profile')}
          />
        )}{' '}
        {['admin', 'operator'].includes(user.role) && (
          <Button
            outline
            title="Facturation"
            icon="credit-card-outline"
            onPress={() => navigate('payments')}
          />
        )}
        <Button outline title="Notifications" icon="bell-outline" onPress={() => navigate('notifications')} />
        <Button outline title="Aide et support" icon="message-outline" onPress={() => navigate('support')} />
        <Button
          outline
          title="Confidentialité"
          icon="shield-lock-outline"
          onPress={() => {
            void Linking.openURL(
              (process.env.EXPO_PUBLIC_WEB_URL ?? 'http://10.0.2.2:3000') + '/confidentialite',
            );
          }}
        />
      </Card>
      <Card>
        <Text style={s.h3}>Mes préférences</Text>
        {pref.data &&
          (['email', 'sms'] as const).map((k) => (
            <View key={k} style={[s.between, { marginVertical: 8 }]}>
              <Text style={[s.body, { flex: 1 }]}>
                {k === 'email' ? 'Recevoir des e-mails' : 'Recevoir des SMS'}
              </Text>
              <Switch
                value={pref.data![k]}
                accessibilityLabel={k === 'email' ? 'Recevoir des e-mails' : 'Recevoir des SMS'}
                disabled={a.busy}
                onValueChange={(value) => {
                  void a.run(async () => {
                    await request('/preferences', 'PATCH', { ...pref.data, [k]: value, consent: true });
                    await pref.refresh();
                  });
                }}
              />
            </View>
          ))}
        <Text style={s.caption}>Envois uniquement si un prestataire est configuré.</Text>
      </Card>
      <Button
        title="Me déconnecter"
        outline
        icon="logout"
        onPress={() =>
          Alert.alert('Me déconnecter', 'Terminer la session sur cet appareil ?', [
            { text: 'Retour', style: 'cancel' },
            { text: 'Me déconnecter', onPress: onLogout },
          ])
        }
      />
    </>
  );
}
export function NotificationsScreen() {
  const r = useData<Notification[]>('/notifications', []),
    a = useTask();
  return (
    <>
      <Heading title="Notifications" />
      {(r.error || a.error) && <Notice error text={r.error || a.error} />}
      <Button outline title="Actualiser" onPress={r.refresh} />
      {r.data.length === 0 ? (
        <Empty title="Aucune notification" text="Les mises à jour de votre espace apparaîtront ici." />
      ) : (
        r.data.map((n) => (
          <Card key={n.id}>
            <Text style={s.h3}>{n.title}</Text>
            <Text style={s.body}>{n.body}</Text>
            <Text style={s.caption}>{localDate(n.createdAt)}</Text>
            {!n.read && (
              <Button
                outline
                title="Marquer comme lu"
                disabled={a.busy}
                onPress={() =>
                  a.run(async () => {
                    await request('/notifications/' + n.id + '/read', 'PATCH');
                    await r.refresh();
                  })
                }
              />
            )}
          </Card>
        ))
      )}
    </>
  );
}
