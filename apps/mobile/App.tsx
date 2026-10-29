import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  BackHandler,
  Linking,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  type User,
  type Care,
  type Service,
  type Capabilities,
  statusLabels,
  money,
  localDate,
} from '@sos/contracts';
import {
  request,
  restoreSession,
  clearSession,
  MobileApiError,
  messageOf,
  onSessionExpired,
} from './src/api';
import { useData } from './src/hooks';
import { AuthScreen } from './src/auth-screen';
import { RequestScreen } from './src/request-screen';
import { DetailScreen } from './src/detail-screen';
import {
  BeneficiaryScreen,
  AvailabilityScreen,
  ProfileScreen,
  TeamScreen,
  AccountScreen,
  NotificationsScreen,
} from './src/personal-screens';
import { PaymentsScreen, AssistantScreen, SupportScreen } from './src/finance-support';
import { Button, Heading, Card, Notice, Empty, Busy, Icon, s, colors, type IconName } from './src/ui';
type CarePage = { items: Care[]; total: number; page: number; pageSize: number };
const routes = [
  'home',
  'requests',
  'beneficiaries',
  'account',
  'availability',
  'team',
  'request',
  'detail',
  'payments',
  'assistant',
  'support',
  'profile',
  'notifications',
];
export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const boot = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (await restoreSession()) {
        const r = await request<{ user: User }>('/auth/me');
        setUser(r.user);
      }
    } catch (e) {
      if (e instanceof MobileApiError && e.status === 401) setUser(null);
      else setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    onSessionExpired(() => setUser(null));
    void boot();
    return () => onSessionExpired(null);
  }, [boot]);
  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        {loading ? (
          <Busy />
        ) : error ? (
          <View style={s.content}>
            <Heading title="Connexion indisponible" />
            <Notice error text={error} />
            <Button title="Réessayer" onPress={boot} />
            <Text style={s.caption}>
              Vos informations médicales ne sont pas enregistrées en cache sur cet appareil.
            </Text>
          </View>
        ) : user ? (
          <MobileWorkspace user={user} onLogout={() => setUser(null)} />
        ) : (
          <AuthScreen onAuth={setUser} />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
function MobileWorkspace({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [route, setRoute] = useState('home'),
    [_history, setHistory] = useState<string[]>([]),
    [careId, setCareId] = useState(''),
    [initialService, setInitialService] = useState<string | undefined>(),
    [refreshKey, setRefreshKey] = useState(0),
    [error, setError] = useState(''),
    config = useData<Capabilities | null>('/config', null);
  const client = user.role === 'client',
    pro = ['doctor', 'nurse'].includes(user.role);
  const goBack = useCallback(() => {
    setHistory((h) => {
      setRoute(h.at(-1) ?? 'home');
      return h.slice(0, -1);
    });
  }, []);
  function navigate(next: string) {
    if (!routes.includes(next)) return;
    setHistory((h) => [...h, route]);
    setRoute(next);
    setError('');
  }
  function detail(id: string) {
    setCareId(id);
    navigate('detail');
  }
  function newRequest(id?: string) {
    setInitialService(id);
    navigate('request');
  }
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (route !== 'home') {
        goBack();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [route, goBack]);
  useEffect(() => {
    const handle = (url: string) => {
      const match = /^sosdocteurs:\/\/cares\/([a-f0-9-]{36})$/i.exec(url);
      if (match) {
        setCareId(match[1]);
        setHistory(['home']);
        setRoute('detail');
      }
    };
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    void Linking.getInitialURL().then((url) => {
      if (url) handle(url);
    });
    return () => sub.remove();
  }, []);
  const tabs: { route: string; label: string; icon: IconName }[] = [
    { route: 'home', label: 'Accueil', icon: 'view-dashboard-outline' },
    {
      route: 'requests',
      label: client ? 'Demandes' : pro ? 'Missions' : 'Demandes',
      icon: 'clipboard-text-outline',
    },
    client
      ? { route: 'beneficiaries', label: 'Mes proches', icon: 'account-group-outline' }
      : pro
        ? { route: 'availability', label: 'Disponibilités', icon: 'calendar-clock-outline' }
        : { route: 'team', label: 'Équipe', icon: 'account-check-outline' },
    { route: 'account', label: 'Mon compte', icon: 'account-circle-outline' },
  ];
  async function logout() {
    try {
      await request('/auth/logout', 'POST');
      await clearSession();
      onLogout();
    } catch (e) {
      setError(messageOf(e));
    }
  }
  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        {route !== 'home' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Revenir à l’écran précédent"
            onPress={goBack}
            style={styles.headerButton}
          >
            <Icon name="arrow-left" color={colors.ink} />
          </Pressable>
        ) : (
          <View style={s.brand}>
            <Icon name="medical-bag" size={30} />
            <View>
              <Text style={s.brandTitle}>SOS DOCTEURS</Text>
              <Text style={s.brandCaption}>VOTRE SANTÉ, NOTRE MISSION</Text>
            </View>
          </View>
        )}
        <View style={s.row}>
          <Pressable
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir les notifications"
            onPress={() => navigate('notifications')}
          >
            <Icon name="bell-outline" size={23} />
          </Pressable>
          <Pressable
            style={styles.avatar}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir mon compte"
            onPress={() => navigate('account')}
          >
            <Text style={{ color: colors.primary, fontWeight: '700' }}>{user.name[0]}</Text>
          </Pressable>
        </View>
      </View>
      {config.data?.demo && (
        <View style={styles.demo}>
          <Text style={styles.demoText}>DÉMONSTRATION · Données fictives · Aucun paiement réel</Text>
        </View>
      )}
      <ScrollView
        key={route + '-' + refreshKey}
        style={{ flex: 1 }}
        contentContainerStyle={[s.content, { width: '100%', maxWidth: 760, alignSelf: 'center' }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              setRefreshKey((k) => k + 1);
              void config.refresh();
            }}
            colors={[colors.primary]}
          />
        }
      >
        {!!error && <Notice error text={error} />}
        {route === 'home' && (
          <HomeScreen user={user} onRequest={newRequest} navigate={navigate} onDetail={detail} />
        )}
        {route === 'requests' && <RequestsScreen user={user} onDetail={detail} />}
        {route === 'request' && client && (
          <RequestScreen
            initialService={initialService}
            onDone={(c) => {
              setCareId(c.id);
              setRoute('detail');
              setRefreshKey((k) => k + 1);
            }}
          />
        )}
        {route === 'detail' && careId && (
          <DetailScreen id={careId} user={user} onPayments={() => navigate('payments')} />
        )}
        {route === 'beneficiaries' && client && <BeneficiaryScreen />}
        {route === 'availability' && pro && <AvailabilityScreen />}
        {route === 'profile' && pro && <ProfileScreen />}
        {route === 'team' && !client && !pro && <TeamScreen user={user} />}
        {route === 'payments' && !pro && <PaymentsScreen user={user} demo={config.data?.demo ?? false} />}
        {route === 'assistant' && client && <AssistantScreen />}
        {route === 'support' && <SupportScreen user={user} />}
        {route === 'notifications' && <NotificationsScreen />}
        {route === 'account' && <AccountScreen user={user} navigate={navigate} onLogout={logout} />}
      </ScrollView>
      <View style={styles.tabs}>
        {tabs.map((t) => (
          <Pressable
            key={t.route}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: route === t.route }}
            onPress={() => {
              setRoute(t.route);
              setHistory(t.route === 'home' ? [] : ['home']);
            }}
            style={styles.tab}
            android_ripple={{ color: colors.soft }}
          >
            <View style={[styles.tabIcon, route === t.route && { backgroundColor: colors.soft }]}>
              <Icon name={t.icon} size={22} color={route === t.route ? colors.primary : colors.muted} />
            </View>
            <Text style={[styles.tabText, route === t.route && { color: colors.primary, fontWeight: '700' }]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </KeyboardAvoidingView>
  );
}
function CareCard({ care, onPress }: { care: Care; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        care.serviceName + ', ' + statusLabels[care.status] + ', ' + localDate(care.startAt)
      }
      onPress={onPress}
      android_ripple={{ color: colors.soft }}
      style={s.card}
    >
      <View style={s.between}>
        <View style={s.iconTile}>
          <Icon name="stethoscope" size={24} />
        </View>
        <View style={s.pill}>
          <Text style={s.pillText}>{statusLabels[care.status]}</Text>
        </View>
      </View>
      <Text style={[s.h3, { marginTop: 16 }]}>{care.serviceName}</Text>
      <Text style={s.caption}>
        {care.beneficiaryName} · {care.zone}
      </Text>
      <Text style={[s.caption, { marginTop: 6 }]}>{localDate(care.startAt)}</Text>
    </Pressable>
  );
}
function HomeScreen({
  user,
  onRequest,
  navigate,
  onDetail,
}: {
  user: User;
  onRequest: (id?: string) => void;
  navigate: (route: string) => void;
  onDetail: (id: string) => void;
}) {
  const cares = useData<CarePage>('/cares', { items: [], total: 0, page: 1, pageSize: 10 }),
    services = useData<Service[]>('/services', []),
    client = user.role === 'client',
    pro = ['doctor', 'nurse'].includes(user.role);
  return (
    <>
      <Heading
        title={'Bonjour, ' + user.name.split(' ')[0] + '.'}
        subtitle="Un point sur votre espace, en toute simplicité."
      />
      {(cares.error || services.error) && (
        <>
          <Notice error text={cares.error || services.error} />
          <Button
            outline
            title="Réessayer le chargement"
            onPress={async () => {
              await Promise.all([cares.refresh(), services.refresh()]);
            }}
          />
        </>
      )}
      <View style={[s.card, { backgroundColor: '#E1EEE4', borderWidth: 0, padding: 25 }]}>
        <Text style={s.eyebrow}>
          {client
            ? 'LES SOINS S’ADAPTENT À VOTRE VIE'
            : pro
              ? 'VOTRE ACTIVITÉ SOS DOCTEURS'
              : 'LA COORDINATION DES SOINS'}
        </Text>
        <Text style={[s.h2, { fontSize: 26 }]}>
          {client
            ? 'Prenez soin de vous,\nlà où vous êtes.'
            : pro
              ? 'Des missions adaptées\nà vos disponibilités.'
              : 'Une prise en charge claire,\nà chaque étape.'}
        </Text>
        <Text style={[s.body, { fontSize: 14, marginBottom: 18 }]}>
          {client
            ? 'À domicile, au bureau ou à distance. Pour vous et pour vos proches.'
            : pro
              ? 'Déclarez vos créneaux et retrouvez les missions qui vous sont attribuées.'
              : 'Vérifiez les demandes et proposez les missions aux professionnels éligibles.'}
        </Text>
        <Button
          title={client ? 'Demander un soin' : pro ? 'Mes disponibilités' : 'Voir les demandes'}
          icon="arrow-right"
          onPress={() => (client ? onRequest() : navigate(pro ? 'availability' : 'requests'))}
        />
      </View>
      <View style={[s.row, { marginBottom: 22, alignItems: 'stretch' }]}>
        {[
          { value: cares.data.total, label: client ? 'Mes demandes' : pro ? 'Mes missions' : 'Demandes' },
          {
            value: cares.data.items.filter((c) => !['completed', 'cancelled', 'failed'].includes(c.status))
              .length,
            label: 'En cours sur cette page',
          },
        ].map((m) => (
          <View key={m.label} style={[s.card, { flex: 1, marginBottom: 0, padding: 16 }]}>
            <Text style={[s.h1, { fontSize: 27, marginBottom: 4 }]}>{m.value}</Text>
            <Text style={s.caption}>{m.label}</Text>
          </View>
        ))}
      </View>
      <View style={[s.between, { marginBottom: 18 }]}>
        <Text style={s.h3}>Vos dernières demandes</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigate('requests')}
          style={{ minHeight: 48, justifyContent: 'center' }}
        >
          <Text style={s.link}>Tout voir</Text>
        </Pressable>
      </View>
      {cares.loading ? (
        <Busy />
      ) : cares.data.items.length ? (
        cares.data.items
          .slice(0, 3)
          .map((c) => <CareCard care={c} key={c.id} onPress={() => onDetail(c.id)} />)
      ) : (
        <Card>
          <Empty
            title="Tout commence par une demande"
            text={
              client
                ? 'Choisissez votre soin et nous vous aidons à organiser la suite.'
                : 'Les nouvelles missions apparaîtront ici après affectation.'
            }
          />
        </Card>
      )}
      {client && (
        <>
          <Text style={[s.h3, { marginTop: 10, marginBottom: 18 }]}>De quel soin avez-vous besoin ?</Text>
          {services.data.map((v) => (
            <Pressable
              key={v.id}
              accessibilityRole="button"
              accessibilityLabel={'Demander : ' + v.name}
              onPress={() => onRequest(v.id)}
              android_ripple={{ color: colors.soft }}
              style={[s.card, s.row, { padding: 17 }]}
            >
              <View style={s.iconTile}>
                <Icon name={v.category === 'video' ? 'video-outline' : 'stethoscope'} size={23} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>{v.name}</Text>
                <Text style={s.caption}>{money(v.price)}</Text>
              </View>
              <Icon name="chevron-right" size={20} />
            </Pressable>
          ))}
        </>
      )}
      <Notice text="La disponibilité est confirmée par la coordination. En cas de danger immédiat, contactez les services d’urgence locaux." />
    </>
  );
}
function RequestsScreen({ user, onDetail }: { user: User; onDetail: (id: string) => void }) {
  const [page, setPage] = useState(1),
    r = useData<CarePage>('/cares?page=' + page, { items: [], total: 0, page: 1, pageSize: 10 });
  return (
    <>
      <Heading
        title={['doctor', 'nurse'].includes(user.role) ? 'Mes missions' : 'Demandes de soins'}
        subtitle="Les étapes de chaque prise en charge."
      />
      {r.error && <Notice error text={r.error} />}
      <Button title="Actualiser" outline icon="refresh" onPress={r.refresh} />
      {r.loading ? (
        <Busy />
      ) : r.data.items.length === 0 ? (
        <Empty
          title="Aucune demande pour le moment"
          text="Les demandes et missions accessibles à votre compte apparaîtront ici."
        />
      ) : (
        r.data.items.map((c) => <CareCard key={c.id} care={c} onPress={() => onDetail(c.id)} />)
      )}
      {r.data.total > 10 && (
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Button outline title="Précédent" disabled={page <= 1} onPress={() => setPage(page - 1)} />
          </View>
          <Text style={s.caption}>
            {page}/{Math.ceil(r.data.total / 10)}
          </Text>
          <View style={{ flex: 1 }}>
            <Button
              outline
              title="Suivant"
              disabled={page * 10 >= r.data.total}
              onPress={() => setPage(page + 1)}
            />
          </View>
        </View>
      )}
    </>
  );
}
const styles = StyleSheet.create({
  header: {
    minHeight: 78,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: { minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.soft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  demo: { backgroundColor: '#FFF4DA', padding: 8, paddingHorizontal: 18 },
  demoText: { fontSize: 9, color: '#72500E', textAlign: 'center' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 7,
  },
  tab: {
    flex: 1,
    minHeight: 60,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 2,
  },
  tabIcon: { width: 47, height: 31, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  tabText: { fontSize: 10, color: colors.muted, textAlign: 'center' },
});
