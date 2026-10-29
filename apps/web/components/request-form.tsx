'use client';
import { useState, useRef, type FormEvent } from 'react';
import { MapPin, ArrowRight, ArrowLeft, ShieldCheck } from 'lucide-react';
import { careSchema, type Service, type Beneficiary, type Care, money, localDate } from '@sos/contracts';
import { MapPicker } from './map-picker';
import { api, errorText } from '../lib/api';
export function RequestForm({
  services,
  beneficiaries,
  zones,
  initialId,
  onDone,
}: {
  services: Service[];
  beneficiaries: Beneficiary[];
  zones: { name: string }[];
  initialId?: string;
  onDone: (c: Care) => void;
}) {
  const [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [geoMessage, setGeoMessage] = useState(''),
    [fields, setFields] = useState({
      serviceId: initialId ?? '',
      beneficiaryId: '',
      address: '',
      zone: zones[0]?.name ?? '',
      date: new Date(Date.now() + 25 * 3600000).toISOString().slice(0, 16),
      description: '',
      urgent: false,
      consent: false,
      latitude: null as number | null,
      longitude: null as number | null,
    });
  const errorRef = useRef<HTMLDivElement>(null);
  const update = (key: string, value: string | boolean | number | null) =>
    setFields((f) => ({ ...f, [key]: value }));
  const service = services.find((s) => s.id === fields.serviceId);
  function report(message: string) {
    setError(message);
    setTimeout(() => errorRef.current?.focus(), 0);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (step === 0) {
      if (!fields.serviceId) {
        report('Choisis un service pour continuer.');
        return;
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      setStep(2);
      return;
    }
    setBusy(true);
    try {
      const input = careSchema.parse({
        serviceId: fields.serviceId,
        beneficiaryId: fields.beneficiaryId || null,
        address: fields.address,
        zone: fields.zone,
        startAt: new Date(fields.date + ':00+01:00').toISOString(),
        description: fields.description,
        urgent: fields.urgent,
        consent: fields.consent,
        latitude: fields.latitude,
        longitude: fields.longitude,
      });
      const c = await api<Care>('/cares', 'POST', input);
      onDone(c);
    } catch (e) {
      report(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function locate() {
    if (!navigator.geolocation) {
      setGeoMessage('Localisation indisponible. Saisis simplement ton adresse.');
      return;
    }
    setGeoMessage('Localisation en cours…');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setFields((f) => ({ ...f, latitude: p.coords.latitude, longitude: p.coords.longitude }));
        setGeoMessage('Point ajouté. Vérifie toujours ton adresse ci-dessous.');
      },
      () => setGeoMessage('Localisation refusée ou indisponible. Tu peux continuer avec ton adresse.'),
      { timeout: 10000, enableHighAccuracy: false },
    );
  }
  return (
    <form onSubmit={submit}>
      <div className="form-stepper" aria-label={'Étape ' + (step + 1) + ' sur 3'}>
        {[0, 1, 2].map((n) => (
          <span key={n} className={step >= n ? 'active' : ''} />
        ))}
      </div>
      {error && (
        <div ref={errorRef} tabIndex={-1} role="alert" className="alert">
          {error}
        </div>
      )}
      {step === 0 && (
        <>
          <p className="eyebrow">ÉTAPE 1 / 3 · LE SOIN</p>
          <h3>De quoi avez-vous besoin ?</h3>
          {services.map((s) => (
            <label className="service-option" key={s.id}>
              <input
                type="radio"
                name="service"
                value={s.id}
                checked={fields.serviceId === s.id}
                onChange={() => update('serviceId', s.id)}
              />
              <span>
                <strong>{s.name}</strong>
                <small>{s.description}</small>
              </span>
              <span>{money(s.price)}</span>
            </label>
          ))}
          {!services.length && (
            <div className="notice">Aucun service n’est disponible. Contacte la coordination.</div>
          )}
        </>
      )}
      {step === 1 && (
        <>
          <p className="eyebrow">ÉTAPE 2 / 3 · LES DÉTAILS</p>
          <h3>Pour qui, où et quand ?</h3>
          <label className="field">
            <span>Bénéficiaire</span>
            <select value={fields.beneficiaryId} onChange={(e) => update('beneficiaryId', e.target.value)}>
              <option value="">Moi-même</option>
              {beneficiaries.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} · {b.relationship}
                </option>
              ))}
            </select>
            <small>Ajoute un proche dans « Mes proches » avant la demande si nécessaire.</small>
          </label>
          <div className="form-grid">
            <label className="field">
              <span>Ville / zone desservie</span>
              <select required value={fields.zone} onChange={(e) => update('zone', e.target.value)}>
                {zones.map((z) => (
                  <option key={z.name}>{z.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Date et heure souhaitées (Bénin, UTC+1)</span>
              <input
                type="datetime-local"
                required
                value={fields.date}
                onChange={(e) => update('date', e.target.value)}
              />
            </label>
          </div>
          <label className="field">
            <span>Adresse et repère</span>
            <input
              required
              minLength={5}
              maxLength={400}
              value={fields.address}
              onChange={(e) => update('address', e.target.value)}
              placeholder="Quartier, rue, repère utile…"
            />
          </label>
          <button type="button" className="btn btn-outline btn-sm" onClick={locate}>
            <MapPin size={15} /> Ajouter ma position (facultatif)
          </button>
          <p className="small muted">
            {geoMessage || 'Votre autorisation sera demandée. La saisie manuelle suffit pour continuer.'}
          </p>
          <MapPicker
            latitude={fields.latitude}
            longitude={fields.longitude}
            onChange={(latitude, longitude) => setFields((f) => ({ ...f, latitude, longitude }))}
          />
          <label className="field">
            <span>Décrivez votre besoin</span>
            <textarea
              required
              minLength={5}
              maxLength={2000}
              value={fields.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Les informations utiles à l’organisation du soin."
            />
          </label>
          <label className="check-field">
            <input
              type="checkbox"
              checked={fields.urgent}
              onChange={(e) => update('urgent', e.target.checked)}
            />
            <span>Je souhaite être contacté rapidement par la coordination.</span>
          </label>
          <div className="notice">
            En cas de danger immédiat, contacte les services d’urgence locaux. Une demande ne garantit pas une
            intervention immédiate.
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <p className="eyebrow">ÉTAPE 3 / 3 · LA CONFIRMATION</p>
          <h3>Tout est prêt ?</h3>
          <div className="wizard-summary">
            <h3>{service?.name}</h3>
            <p>
              Bénéficiaire : {beneficiaries.find((b) => b.id === fields.beneficiaryId)?.name ?? 'Moi-même'}
            </p>
            <p>
              {fields.address} · {fields.zone}
            </p>
            <p>{localDate(new Date(fields.date + ':00+01:00').toISOString())}</p>
            <p>{fields.description}</p>
            <strong>{money(service?.price ?? null)}</strong>
          </div>
          <p className="small muted">
            Il s’agit d’une estimation, à confirmer par la coordination. Le paiement intervient après les
            soins.
          </p>
          <label className="check-field">
            <input
              type="checkbox"
              required
              checked={fields.consent}
              onChange={(e) => update('consent', e.target.checked)}
            />
            <span>
              Je suis autorisé à faire cette demande et j’accepte l’utilisation des informations nécessaires à
              la prise en charge.
            </span>
          </label>
          <div className="notice">
            <ShieldCheck size={15} /> La disponibilité du professionnel reste à confirmer.
          </div>
        </>
      )}
      <div className="actions">
        {step > 0 && (
          <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setStep(step - 1)}>
            <ArrowLeft size={16} /> Retour
          </button>
        )}
        <button className="btn" disabled={busy || !services.length}>
          {busy ? 'Envoi…' : step === 2 ? 'Confirmer ma demande' : 'Continuer'}
          <ArrowRight size={16} />
        </button>
      </div>
    </form>
  );
}
