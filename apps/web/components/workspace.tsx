'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  CreditCard,
  Stethoscope,
  Settings,
  MessageCircle,
  LogOut,
  Bell,
  Plus,
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  ClipboardList,
  Menu,
  X,
  HeartPulse,
  RefreshCw,
  FileCheck,
  UserCircle,
} from 'lucide-react';
import { type LucideIcon } from 'lucide-react';
import {
  type User,
  type Service,
  type Beneficiary,
  type Care,
  type Capabilities,
  type CareStatus,
  roleLabels,
  money,
  statuses,
  statusLabels,
} from '@sos/contracts';
import { api, ApiError, setCsrf, errorText } from '../lib/api';
import { useResource } from '../lib/hooks';
import { Brand } from './brand';
import { Modal, Empty, CareRows, Pagination } from './workspace-ui';
import { RequestForm } from './request-form';
import { CareDetail } from './care-detail';
import {
  BeneficiariesPanel,
  AvailabilityPanel,
  ProfilePanel,
  NotificationsPanel,
  SettingsPanel,
} from './personal-panels';
import { PaymentsPanel, AssistantPanel, SupportPanel } from './finance-support';
import { TeamPanel, UsersPanel, ServicesPanel, AuditPanel } from './admin-panels';
import { OperationsPanel, EarningsPanel } from './operations-panel';
type Tab =
  | 'dashboard'
  | 'requests'
  | 'beneficiaries'
  | 'payments'
  | 'availability'
  | 'profile'
  | 'team'
  | 'users'
  | 'services'
  | 'audit'
  | 'assistant'
  | 'support'
  | 'settings'
  | 'notifications'
  | 'operations'
  | 'earnings';
type NavItem = { key: Tab; label: string; icon: LucideIcon };
type CarePage = { items: Care[]; total: number; page: number; pageSize: number };
export function Workspace() {
  const router = useRouter(),
    query = useSearchParams(),
    [user, setUser] = useState<User | null>(null),
    [authError, setAuthError] = useState(''),
    [authLoading, setAuthLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api<{ user: User; csrf: string }>('/auth/me')
      .then((r) => {
        if (active) {
          setCsrf(r.csrf);
          setUser(r.user);
        }
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401)
          router.replace('/connexion' + (query.get('nouveau') ? '?retour=demande' : ''));
        else if (active) setAuthError(errorText(e));
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router, query]);
  if (authLoading)
    return (
      <main id="main" className="loading">
        <span className="spinner" />
        Ouverture de votre espace…
      </main>
    );
  if (authError)
    return (
      <main id="main" className="container prose">
        <Brand />
        <div className="alert" role="alert">
          {authError}
        </div>
        <button className="btn" onClick={() => window.location.reload()}>
          Réessayer
        </button>
      </main>
    );
  return user ? (
    <AuthenticatedWorkspace user={user} initialNew={query.get('nouveau') === '1'} />
  ) : (
    <main id="main" className="loading">
      Redirection vers la connexion…
    </main>
  );
}
function AuthenticatedWorkspace({ user, initialNew }: { user: User; initialNew: boolean }) {
  const router = useRouter(),
    [tab, setTab] = useState<Tab>('dashboard'),
    [page, setPage] = useState(1),
    [showRequest, setShowRequest] = useState(initialNew && user.role === 'client'),
    [initialService, setInitialService] = useState<string | undefined>(),
    [selected, setSelected] = useState<Care | null>(null),
    [menu, setMenu] = useState(false),
    [error, setError] = useState(''),
    [success, setSuccess] = useState(''),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all');
  const heading = useRef<HTMLHeadingElement>(null);
  const cares = useResource<CarePage>('/cares?page=' + page, { items: [], total: 0, page: 1, pageSize: 10 }),
    services = useResource<Service[]>('/services', []),
    config = useResource<Capabilities | null>('/config', null),
    zones = useResource<{ name: string }[]>('/zones', []),
    beneficiaries = useResource<Beneficiary[]>(user.role === 'client' ? '/beneficiaries' : '/services', []);
  const ops = ['admin', 'operator'].includes(user.role),
    pro = ['doctor', 'nurse'].includes(user.role),
    client = user.role === 'client';
  const nav: NavItem[] = [
    { key: 'dashboard', label: 'Vue d’ensemble', icon: LayoutDashboard },
    {
      key: 'requests',
      label: client ? 'Mes demandes' : pro ? 'Mes missions' : 'Demandes de soins',
      icon: ClipboardList,
    },
    ...(client
      ? [
          { key: 'beneficiaries' as Tab, label: 'Mes proches', icon: Users },
          { key: 'payments' as Tab, label: 'Paiements & reçus', icon: CreditCard },
          { key: 'assistant' as Tab, label: 'Guide santé', icon: Sparkles },
        ]
      : []),
    ...(pro
      ? [
          { key: 'availability' as Tab, label: 'Mes disponibilités', icon: CalendarDays },
          { key: 'profile' as Tab, label: 'Mon profil professionnel', icon: UserCircle },
          { key: 'earnings' as Tab, label: 'Mon activité facturée', icon: CreditCard },
        ]
      : []),
    ...(ops
      ? [
          { key: 'team' as Tab, label: 'Professionnels', icon: FileCheck },
          { key: 'operations' as Tab, label: 'Coordination & réglages', icon: Settings },
          { key: 'payments' as Tab, label: 'Facturation', icon: CreditCard },
        ]
      : []),
    ...(user.role === 'admin'
      ? [
          { key: 'users' as Tab, label: 'Utilisateurs', icon: Users },
          { key: 'services' as Tab, label: 'Services & tarifs', icon: Stethoscope },
          { key: 'audit' as Tab, label: 'Journal d’audit', icon: ShieldCheck },
        ]
      : []),
    { key: 'support', label: ops ? 'Support & réclamations' : 'Aide & support', icon: MessageCircle },
    { key: 'settings', label: 'Mon compte', icon: Settings },
  ];
  const tabLabel = nav.find((n) => n.key === tab)?.label ?? 'Notifications';
  function navigate(next: Tab) {
    setTab(next);
    setMenu(false);
    setError('');
    setSuccess('');
    setTimeout(() => heading.current?.focus(), 0);
  }
  function newRequest(id?: string) {
    setInitialService(id);
    setShowRequest(true);
  }
  async function open(c: Care) {
    setError('');
    try {
      setSelected(await api<Care>('/cares/' + c.id));
    } catch (e) {
      setError(errorText(e));
    }
  }
  const visible = cares.data.items.filter(
    (c) =>
      (filter === 'all' || c.status === filter) &&
      (c.serviceName + ' ' + c.beneficiaryName + ' ' + c.zone).toLowerCase().includes(search.toLowerCase()),
  );
  const active = cares.data.items.filter(
      (c) => !['completed', 'cancelled', 'failed'].includes(c.status),
    ).length,
    completed = cares.data.items.filter((c) => c.status === 'completed').length;
  return (
    <div className="app-shell">
      <aside className={'sidebar' + (menu ? ' open' : '')} aria-label="Navigation de votre espace">
        <Brand />
        <p className="nav-label">VOTRE ESPACE {roleLabels[user.role].toUpperCase()}</p>
        <nav className="side-nav">
          {nav.map((n) => (
            <button
              key={n.key}
              aria-current={tab === n.key ? 'page' : undefined}
              onClick={() => navigate(n.key)}
            >
              <n.icon />
              {n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <strong>Besoin d’être accompagné ?</strong>
            <p>Notre équipe vous aide à organiser votre prise en charge.</p>
            <a href="tel:+2290196751075">
              01 96 75 10 75 <ArrowRight size={12} />
            </a>
          </div>
          <button
            className="logout-btn"
            onClick={async () => {
              try {
                await api('/auth/logout', 'POST');
                setCsrf('');
                router.replace('/connexion');
              } catch (e) {
                setError(errorText(e));
              }
            }}
          >
            <LogOut size={17} /> Me déconnecter
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-header">
          <button
            className="icon-btn mobile-menu"
            aria-label={menu ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
          <div className="breadcrumb">
            Mon espace <span aria-hidden="true"> / </span>
            <b>{tabLabel}</b>
          </div>
          <div className="header-profile">
            <button className="icon-btn" aria-label="Notifications" onClick={() => navigate('notifications')}>
              <Bell />
            </button>
            <span className="avatar">
              {user.name
                .split(' ')
                .slice(0, 2)
                .map((n) => n[0])
                .join('')}
            </span>
            <div>
              <strong>{user.name}</strong>
              <small>{roleLabels[user.role]}</small>
            </div>
          </div>
        </header>
        {config.data?.demo && (
          <div className="demo-banner">
            MODE DÉMONSTRATION · Données fictives · Aucun soin ni paiement réel
          </div>
        )}
        <main id="main" className="workspace">
          <div className="page-heading">
            <div>
              <p className="eyebrow">VOTRE SANTÉ, NOTRE MISSION</p>
              <h1 ref={heading} tabIndex={-1}>
                {tab === 'dashboard' ? 'Bonjour, ' + user.name.split(' ')[0] + '.' : tabLabel}
              </h1>
              <p>
                {tab === 'dashboard'
                  ? 'Un point sur votre espace, en toute simplicité.'
                  : tab === 'requests'
                    ? 'Retrouvez les étapes et les détails de chaque prise en charge.'
                    : 'Gérez vos informations dans votre espace sécurisé.'}
              </p>
            </div>
            {client && ['dashboard', 'requests'].includes(tab) && (
              <button className="btn" onClick={() => newRequest()}>
                <Plus size={17} /> Demander un soin
              </button>
            )}
          </div>
          {(error || cares.error || services.error) && (
            <div className="alert" role="alert">
              {error || cares.error || services.error}{' '}
              <button
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setError('');
                  void cares.refresh();
                  void services.refresh();
                }}
              >
                Réessayer
              </button>
            </div>
          )}
          {success && (
            <div className="alert alert-success" role="status">
              {success}
            </div>
          )}
          {tab === 'dashboard' && (
            <>
              <section className="welcome-card">
                <div>
                  <p className="eyebrow">
                    {client
                      ? 'LES SOINS S’ADAPTENT À VOTRE VIE'
                      : pro
                        ? 'VOTRE ACTIVITÉ SOS DOCTEURS'
                        : 'COORDONNER, ACCOMPAGNER, SUIVRE'}
                  </p>
                  <h2>
                    {client
                      ? 'Prenez soin de vous, là où vous êtes.'
                      : pro
                        ? 'Chaque mission commence par votre disponibilité.'
                        : 'Une prise en charge claire, à chaque étape.'}
                  </h2>
                  <p>
                    {client
                      ? 'Une consultation, un examen ou un soin pour un proche ? Faites votre demande. Nous vous aidons à organiser la suite.'
                      : pro
                        ? 'Déclarez vos créneaux et retrouvez uniquement les missions qui vous sont attribuées.'
                        : 'Vérifiez les demandes, confirmez les tarifs et proposez les missions aux professionnels éligibles.'}
                  </p>
                  <button
                    className="btn btn-sm"
                    onClick={() => (client ? newRequest() : navigate(pro ? 'availability' : 'requests'))}
                  >
                    {client ? 'Organiser un soin' : pro ? 'Gérer mes disponibilités' : 'Voir les demandes'}
                    <ArrowRight size={15} />
                  </button>
                </div>
                <Stethoscope aria-hidden="true" />
              </section>
              <div className="metrics">
                {[
                  {
                    label: client ? 'Mes demandes' : pro ? 'Mes missions' : 'Demandes de soins',
                    value: cares.data.total,
                    sub: 'Au total',
                    icon: ClipboardList,
                  },
                  { label: 'En cours', value: active, sub: 'Sur cette page', icon: CalendarDays },
                  { label: 'Terminées', value: completed, sub: 'Sur cette page', icon: ShieldCheck },
                ].map((m) => (
                  <article className="metric" key={m.label}>
                    <div>
                      <span>{m.label}</span>
                      <strong>{m.value}</strong>
                      <small>{m.sub}</small>
                    </div>
                    <span className="icon-tile">
                      <m.icon />
                    </span>
                  </article>
                ))}
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>
                      {client
                        ? 'Vos dernières demandes'
                        : pro
                          ? 'Vos dernières missions'
                          : 'Les dernières demandes'}
                    </h2>
                    <p>Les informations affichées proviennent de vos données accessibles.</p>
                  </div>
                  <button
                    className="text-link"
                    style={{ background: 'none', border: 0 }}
                    onClick={() => navigate('requests')}
                  >
                    Tout voir <ChevronRight size={15} />
                  </button>
                </div>
                {cares.loading ? (
                  <p className="small muted">Chargement…</p>
                ) : cares.data.items.length ? (
                  <CareRows items={cares.data.items.slice(0, 4)} onOpen={open} />
                ) : (
                  <Empty
                    action={client ? 'Faire ma première demande' : undefined}
                    onAction={client ? () => newRequest() : undefined}
                  />
                )}
              </section>
              {client && (
                <section className="panel">
                  <div className="panel-heading">
                    <h2>De quel soin avez-vous besoin ?</h2>
                    <HeartPulse size={20} color="#006b45" />
                  </div>
                  <div className="mini-services">
                    {services.data.map((s) => (
                      <button className="mini-service" key={s.id} onClick={() => newRequest(s.id)}>
                        <span className="icon-tile">
                          <Stethoscope size={20} />
                        </span>
                        <span>
                          <strong>{s.name}</strong>
                          <small>{money(s.price)}</small>
                        </span>
                        <ChevronRight />
                      </button>
                    ))}
                  </div>
                </section>
              )}
              <div className="notice">
                Une demande n’est pas une confirmation de disponibilité. En cas de danger immédiat, contacte
                les services d’urgence locaux.
              </div>
            </>
          )}
          {tab === 'requests' && (
            <section className="panel">
              <div className="row-tools">
                <label className="field">
                  <span>Rechercher sur cette page</span>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Soin, bénéficiaire, ville…"
                  />
                </label>
                <label className="field">
                  <span>Filtrer les statuts de cette page</span>
                  <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                    <option value="all">Tous les statuts</option>
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {statusLabels[s as CareStatus]}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="icon-btn"
                  aria-label="Actualiser les demandes"
                  onClick={() => cares.refresh()}
                >
                  <RefreshCw size={17} />
                </button>
              </div>
              {visible.length ? (
                <CareRows items={visible} onOpen={open} />
              ) : (
                <Empty
                  title={
                    search || filter !== 'all'
                      ? 'Aucun résultat sur cette page'
                      : 'Aucune demande pour le moment'
                  }
                  text={
                    pro
                      ? 'Les missions apparaissent après la vérification de votre profil et une proposition de la coordination.'
                      : 'Vos demandes et leur suivi apparaîtront ici.'
                  }
                />
              )}
              <Pagination page={page} total={cares.data.total} size={10} onPage={setPage} />
            </section>
          )}
          {tab === 'beneficiaries' && client && <BeneficiariesPanel />}
          {tab === 'availability' && pro && <AvailabilityPanel />}
          {tab === 'profile' && pro && <ProfilePanel />}
          {tab === 'payments' && (client || ops) && (
            <PaymentsPanel user={user} demo={config.data?.demo ?? false} />
          )}
          {tab === 'assistant' && client && <AssistantPanel />}
          {tab === 'support' && <SupportPanel user={user} />}{' '}
          {tab === 'settings' && <SettingsPanel user={user} />}{' '}
          {tab === 'notifications' && <NotificationsPanel />}
          {tab === 'operations' && ops && <OperationsPanel user={user} />}{' '}
          {tab === 'earnings' && pro && <EarningsPanel />}{' '}
          {tab === 'team' && ops && <TeamPanel user={user} />}{' '}
          {tab === 'users' && user.role === 'admin' && <UsersPanel self={user} />}{' '}
          {tab === 'services' && user.role === 'admin' && <ServicesPanel />}{' '}
          {tab === 'audit' && user.role === 'admin' && <AuditPanel />}
        </main>
      </div>
      {showRequest && client && (
        <Modal title="Organiser votre soin" onClose={() => setShowRequest(false)}>
          <RequestForm
            services={services.data}
            beneficiaries={beneficiaries.data}
            zones={zones.data}
            initialId={initialService}
            onDone={(c) => {
              setShowRequest(false);
              setSuccess(
                'Votre demande a été enregistrée. La coordination doit confirmer la prise en charge.',
              );
              setSelected({ ...c, events: [] });
              void cares.refresh();
            }}
          />
        </Modal>
      )}
      {selected && (
        <Modal title="Suivi de votre demande" onClose={() => setSelected(null)}>
          <CareDetail
            initial={selected}
            user={user}
            onChanged={() => {
              void cares.refresh();
            }}
          />
        </Modal>
      )}
    </div>
  );
}
