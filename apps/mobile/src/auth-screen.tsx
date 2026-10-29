import { useEffect, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Pressable, Switch } from 'react-native';
import {
  type User,
  type Role,
  type Capabilities,
  roleLabels,
  registerSchema,
  loginSchema,
} from '@sos/contracts';
import { Button, Field, Icon, Notice, s, colors } from './ui';
import { request, saveSession, currentEndpoint, setEndpoint } from './api';
import { useTask } from './hooks';
export function AuthScreen({ onAuth }: { onAuth: (u: User) => void }) {
  const [server, setServer] = useState(currentEndpoint());
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login'),
    [show, setShow] = useState(false),
    [demo, setDemo] = useState(false),
    [info, setInfo] = useState(''),
    [token, setToken] = useState(''),
    [f, setF] = useState({
      name: '',
      email: '',
      password: '',
      phone: '+22901',
      role: 'client' as 'client' | 'doctor' | 'nurse',
      consent: false,
    }),
    a = useTask();
  useEffect(() => {
    request<Capabilities>('/config')
      .then((v) => setDemo(v.demo))
      .catch(() => {});
  }, []);
  const update = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  async function submit() {
    await a.run(async () => {
      if (mode === 'forgot') {
        const r = await request<{ message: string; developmentToken?: string }>('/auth/forgot', 'POST', {
          email: f.email,
        });
        setInfo(r.message);
        if (r.developmentToken) {
          setToken(r.developmentToken);
          setInfo('Démo : code temporaire prérempli. Aucune transmission externe.');
        }
        setMode('reset');
        return;
      }
      if (mode === 'reset') {
        await request('/auth/reset', 'POST', { token, password: f.password });
        setMode('login');
        setInfo('Mot de passe modifié. Reconnectez-vous.');
        return;
      }
      const body =
        mode === 'register'
          ? registerSchema.parse(f)
          : loginSchema.parse({ email: f.email, password: f.password });
      const r = await request<{ user: User; token: string }>(
        '/auth/' + (mode === 'register' ? 'register' : 'login'),
        'POST',
        body,
      );
      await saveSession(r.token);
      onAuth(r.user);
    });
  }
  async function loginDemo(role: Role) {
    await a.run(async () => {
      const handle = {
        client: 'patient',
        doctor: 'medecin',
        nurse: 'infirmier',
        operator: 'coordination',
        admin: 'admin',
      }[role];
      const r = await request<{ user: User; token: string }>('/auth/login', 'POST', {
        email: handle + '@demo.sos.test',
        password: 'Demo-SOS-2026!',
      });
      await saveSession(r.token);
      onAuth(r.user);
    });
  }
  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: 35 }]} keyboardShouldPersistTaps="handled">
        <View style={[s.brand, { marginBottom: 35 }]}>
          <Icon name="medical-bag" size={38} />
          <View>
            <Text style={s.brandTitle}>SOS DOCTEURS</Text>
            <Text style={s.brandCaption}>VOTRE SANTÉ, NOTRE MISSION</Text>
          </View>
        </View>
        <Text style={s.eyebrow}>LA SANTÉ, PLUS PROCHE DE VOUS</Text>
        <Text accessibilityRole="header" style={[s.h1, { fontSize: 36 }]}>
          Le bon soin.{'\n'}
          <Text style={{ color: colors.primary }}>Au bon endroit.</Text>
        </Text>
        <Text style={[s.body, { marginBottom: 28 }]}>
          Organisez vos soins et ceux de vos proches depuis votre espace personnel.
        </Text>
        <View style={s.card}>
          <View style={[s.row, { marginBottom: 22 }]}>
            {(['login', 'register'] as const).map((v) => (
              <Pressable
                key={v}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === v }}
                onPress={() => {
                  setMode(v);
                  a.setError('');
                }}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderBottomWidth: 2,
                  borderBottomColor: mode === v ? colors.primary : colors.border,
                }}
              >
                <Text
                  style={{
                    textAlign: 'center',
                    fontWeight: '600',
                    color: mode === v ? colors.primary : colors.muted,
                  }}
                >
                  {v === 'login' ? 'Connexion' : 'Créer un compte'}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.h3}>
            {mode === 'register'
              ? 'Faisons connaissance.'
              : mode === 'forgot'
                ? 'Retrouver votre accès'
                : mode === 'reset'
                  ? 'Nouveau mot de passe'
                  : 'Ravi de vous retrouver.'}
          </Text>
          {a.error && <Notice error text={a.error} />} {!!info && <Notice text={info} />}
          {mode === 'register' && (
            <Field
              label="Nom et prénom"
              value={f.name}
              onChangeText={(v) => update('name', v)}
              autoComplete="name"
              maxLength={100}
            />
          )}
          {mode !== 'reset' && (
            <Field
              label="Adresse e-mail"
              value={f.email}
              onChangeText={(v) => update('email', v)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          )}
          {mode !== 'forgot' && (
            <>
              <Field
                label="Mot de passe"
                value={f.password}
                onChangeText={(v) => update('password', v)}
                secureTextEntry={!show}
                autoCapitalize="none"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                hint={mode === 'login' ? undefined : 'Au moins 12 caractères.'}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                style={{ minHeight: 44, justifyContent: 'center', marginBottom: 10 }}
                onPress={() => setShow(!show)}
              >
                <Text style={s.caption}>{show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}</Text>
              </Pressable>
            </>
          )}
          {mode === 'register' && (
            <>
              <Field
                label="Téléphone au Bénin"
                value={f.phone}
                onChangeText={(v) => update('phone', v)}
                keyboardType="phone-pad"
                autoComplete="tel"
                hint="+22901 suivi de 8 chiffres"
              />
              <Text style={s.label}>Votre rôle</Text>
              <View style={{ gap: 8, marginVertical: 12 }}>
                {(['client', 'doctor', 'nurse'] as const).map((r) => (
                  <Button
                    key={r}
                    outline={f.role !== r}
                    title={roleLabels[r]}
                    onPress={() => update('role', r)}
                  />
                ))}
              </View>
              {f.role !== 'client' && (
                <Notice text="Votre profil et vos justificatifs doivent être validés avant de recevoir une mission." />
              )}
              <View style={[s.row, { marginVertical: 12 }]}>
                <Switch
                  value={f.consent}
                  onValueChange={(v) => update('consent', v)}
                  accessibilityLabel="Accepter le traitement des données nécessaires au compte"
                  trackColor={{ true: colors.primary }}
                />
                <Text style={[s.caption, { flex: 1 }]}>
                  J’accepte l’utilisation des informations nécessaires à mon compte et j’ai pris connaissance
                  de la confidentialité.
                </Text>
              </View>
            </>
          )}
          {mode === 'reset' && (
            <Field label="Code temporaire" value={token} onChangeText={setToken} autoCapitalize="none" />
          )}
          <Button
            title={
              a.busy
                ? 'Un instant…'
                : mode === 'register'
                  ? 'Créer mon compte'
                  : mode === 'forgot'
                    ? 'Recevoir les instructions'
                    : mode === 'reset'
                      ? 'Modifier le mot de passe'
                      : 'Me connecter'
            }
            onPress={submit}
            disabled={a.busy}
            icon="arrow-right"
          />
          {mode === 'login' && (
            <Button title="Mot de passe oublié ?" outline onPress={() => setMode('forgot')} />
          )}
        </View>
        {demo && (
          <View style={s.card}>
            <Text style={s.h3}>Découvrir les espaces</Text>
            <Notice text="Démonstration uniquement. Données fictives, aucun paiement réel." />
            <View style={{ gap: 6 }}>
              {(['client', 'doctor', 'nurse', 'operator', 'admin'] as Role[]).map((r) => (
                <Button
                  key={r}
                  outline
                  title={roleLabels[r]}
                  onPress={() => loginDemo(r)}
                  disabled={a.busy}
                />
              ))}
            </View>
          </View>
        )}
        {process.env.EXPO_PUBLIC_DEMO_MODE === 'true' && (
          <View style={s.card}>
            <Text style={s.h3}>Serveur de démonstration</Text>
            <Field
              label="Adresse de l’API"
              value={server}
              onChangeText={setServer}
              autoCapitalize="none"
              keyboardType="url"
              hint="Émulateur : http://10.0.2.2:4000/api · Téléphone : adresse IP locale du PC."
            />
            <Button
              title="Utiliser ce serveur"
              outline
              disabled={a.busy}
              onPress={() =>
                a.run(async () => {
                  await setEndpoint(server);
                  const v = await request<Capabilities>('/config');
                  setDemo(v.demo);
                  setInfo('Serveur de démonstration connecté.');
                })
              }
            />
          </View>
        )}
        <Text style={[s.caption, { textAlign: 'center' }]}>
          En cas de danger immédiat, contactez les services d’urgence locaux.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
