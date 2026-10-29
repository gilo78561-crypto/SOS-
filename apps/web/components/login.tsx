'use client';
import { useState, useEffect, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, ShieldCheck, House, Eye, EyeOff } from 'lucide-react';
import {
  type User,
  type Capabilities,
  roleLabels,
  type Role,
  registerSchema,
  loginSchema,
} from '@sos/contracts';
import { Brand } from './brand';
import { api, setCsrf, errorText } from '../lib/api';
export function Login() {
  const router = useRouter(),
    query = useSearchParams();
  const [mode, setMode] = useState(query.get('mode') === 'inscription' ? 'register' : 'login'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [success, setSuccess] = useState(''),
    [show, setShow] = useState(false),
    [demo, setDemo] = useState(false);
  const [values, setValues] = useState({
      name: '',
      email: '',
      password: '',
      phone: '+22901',
      role: 'client' as 'client' | 'doctor' | 'nurse',
      consent: false,
    }),
    [resetToken, setResetToken] = useState('');
  useEffect(() => {
    api<Capabilities>('/config')
      .then((c) => setDemo(c.demo))
      .catch(() => {});
  }, []);
  const update = (key: string, value: string | boolean) => setValues((v) => ({ ...v, [key]: value }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      if (mode === 'forgot') {
        const result = await api<{ message: string; developmentToken?: string }>('/auth/forgot', 'POST', {
          email: values.email,
        });
        setSuccess(
          result.message + (result.developmentToken ? ' Démo — code : ' + result.developmentToken : ''),
        );
        if (result.developmentToken) setResetToken(result.developmentToken);
        setMode('reset');
      } else if (mode === 'reset') {
        await api('/auth/reset', 'POST', { token: resetToken, password: values.password });
        setSuccess('Mot de passe modifié. Tu peux te connecter.');
        setMode('login');
      } else {
        const payload =
          mode === 'register'
            ? registerSchema.parse(values)
            : loginSchema.parse({ email: values.email, password: values.password });
        const result = await api<{ user: User; csrf: string }>(
          '/auth/' + (mode === 'register' ? 'register' : 'login'),
          'POST',
          payload,
        );
        setCsrf(result.csrf);
        router.push('/espace' + (query.get('retour') === 'demande' ? '?nouveau=1' : ''));
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function enterDemo(role: Role) {
    setBusy(true);
    setError('');
    try {
      const handle = {
        client: 'patient',
        doctor: 'medecin',
        nurse: 'infirmier',
        operator: 'coordination',
        admin: 'admin',
      }[role];
      const result = await api<{ user: User; csrf: string }>('/auth/login', 'POST', {
        email: handle + '@demo.sos.test',
        password: 'Demo-SOS-2026!',
      });
      setCsrf(result.csrf);
      router.push('/espace');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <header className="container public-header">
        <Brand />
        <Link href="/" className="text-link">
          Retour à l’accueil
        </Link>
      </header>
      <main id="main" className="container auth-layout">
        <div className="auth-intro">
          <p className="eyebrow">BIENVENUE CHEZ SOS DOCTEURS</p>
          <h1>
            Un espace pour
            <br />
            <em>prendre soin de vous.</em>
          </h1>
          <p>Retrouvez vos demandes, organisez les soins de vos proches et suivez chaque étape simplement.</p>
          <div className="auth-benefit">
            <span className="icon-tile">
              <House size={22} />
            </span>
            <span>Vos soins, à l’adresse qui vous convient.</span>
          </div>
          <div className="auth-benefit">
            <span className="icon-tile">
              <ShieldCheck size={22} />
            </span>
            <span>Un accès personnel à vos informations.</span>
          </div>
        </div>
        <div className="auth-card">
          <div className="auth-tabs" role="tablist" aria-label="Accès au compte">
            <button
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => {
                setMode('login');
                setError('');
              }}
            >
              Connexion
            </button>
            <button
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => {
                setMode('register');
                setError('');
              }}
            >
              Créer un compte
            </button>
          </div>
          <h2>
            {mode === 'register'
              ? 'Faisons connaissance.'
              : mode === 'forgot'
                ? 'Retrouver votre accès'
                : mode === 'reset'
                  ? 'Nouveau mot de passe'
                  : 'Ravi de vous retrouver.'}
          </h2>
          <p>
            {mode === 'register'
              ? 'Quelques informations pour organiser vos soins.'
              : 'Accédez à votre espace SOS DOCTEURS.'}
          </p>
          {error && (
            <div className="alert" role="alert" tabIndex={-1}>
              {error}
            </div>
          )}
          {success && (
            <div className="alert alert-success" role="status">
              {success}
            </div>
          )}
          <form onSubmit={submit}>
            {mode === 'register' && (
              <label className="field">
                <span>Nom et prénom</span>
                <input
                  autoComplete="name"
                  required
                  value={values.name}
                  onChange={(e) => update('name', e.target.value)}
                  minLength={2}
                  maxLength={100}
                />
              </label>
            )}
            {mode !== 'reset' && (
              <label className="field">
                <span>Adresse e-mail</span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={values.email}
                  onChange={(e) => update('email', e.target.value)}
                />
              </label>
            )}
            {(mode === 'login' || mode === 'register' || mode === 'reset') && (
              <label className="field">
                <span>Mot de passe</span>
                <span className="input-with-button">
                  <input
                    type={show ? 'text' : 'password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    minLength={mode === 'login' ? 1 : 12}
                    required
                    maxLength={128}
                    value={values.password}
                    onChange={(e) => update('password', e.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    onClick={() => setShow(!show)}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
                {mode !== 'login' && <small>Au moins 12 caractères.</small>}
              </label>
            )}
            {mode === 'register' && (
              <>
                <label className="field">
                  <span>Téléphone au Bénin</span>
                  <input
                    type="tel"
                    autoComplete="tel"
                    required
                    pattern="\+22901[0-9]{8}"
                    value={values.phone}
                    onChange={(e) => update('phone', e.target.value)}
                  />
                  <small>Exemple : +2290190000000</small>
                </label>
                <label className="field">
                  <span>Je souhaite m’inscrire comme</span>
                  <select value={values.role} onChange={(e) => update('role', e.target.value)}>
                    <option value="client">Patient / proche</option>
                    <option value="doctor">Médecin</option>
                    <option value="nurse">Infirmier</option>
                  </select>
                </label>
                {values.role !== 'client' && (
                  <div className="notice">
                    Un professionnel doit compléter son profil et faire valider ses justificatifs avant de
                    recevoir des missions.
                  </div>
                )}
                <label className="check-field">
                  <input
                    type="checkbox"
                    required
                    checked={values.consent}
                    onChange={(e) => update('consent', e.target.checked)}
                  />
                  <span>
                    J’ai lu les informations de <Link href="/confidentialite">confidentialité</Link> et
                    j’accepte l’utilisation des données nécessaires à mon compte.
                  </span>
                </label>
              </>
            )}
            {mode === 'reset' && (
              <label className="field">
                <span>Code temporaire reçu</span>
                <input
                  required
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  autoComplete="one-time-code"
                />
              </label>
            )}
            <button className="btn full" disabled={busy}>
              {busy
                ? 'Un instant…'
                : mode === 'register'
                  ? 'Créer mon compte'
                  : mode === 'forgot'
                    ? 'Recevoir les instructions'
                    : mode === 'reset'
                      ? 'Modifier le mot de passe'
                      : 'Me connecter'}
              <ArrowRight size={17} />
            </button>
          </form>
          {mode === 'login' && (
            <div className="auth-bottom">
              <button
                onClick={() => {
                  setMode('forgot');
                  setError('');
                }}
              >
                Mot de passe oublié ?
              </button>
            </div>
          )}
          {demo && (
            <div className="demo-panel">
              <strong className="small">Découvrir les différents espaces</strong>
              <p>Démonstration avec des comptes fictifs. Aucune donnée médicale réelle.</p>
              <div className="demo-roles">
                {(['client', 'doctor', 'nurse', 'operator', 'admin'] as Role[]).map((r) => (
                  <button key={r} disabled={busy} onClick={() => enterDemo(r)}>
                    {roleLabels[r]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
