import Link from 'next/link';
import {
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  MapPin,
  Phone,
  Stethoscope,
  HeartPulse,
  TestTube,
  ScanLine,
  Video,
  Check,
  Clock3,
  House,
  CalendarDays,
  ChevronDown,
  MoveRight,
} from 'lucide-react';
import { Brand } from '../components/brand';
const services = [
  {
    icon: Stethoscope,
    name: 'Consultation médicale',
    text: 'Un généraliste ou un spécialiste, à votre domicile ou à votre bureau.',
    tag: 'À VOTRE ADRESSE',
  },
  {
    icon: HeartPulse,
    name: 'Soins infirmiers',
    text: 'Une prise en charge de proximité, adaptée aux soins demandés.',
    tag: 'UN ACCOMPAGNEMENT ATTENTIF',
  },
  {
    icon: TestTube,
    name: 'Prélèvements sanguins',
    text: 'Organisez votre prélèvement sans vous déplacer.',
    tag: 'À DOMICILE',
  },
  {
    icon: ScanLine,
    name: 'Échographie',
    text: 'Un examen à domicile, selon indication et disponibilité.',
    tag: 'SUR RENDEZ-VOUS',
  },
  {
    icon: HeartPulse,
    name: 'Électrocardiogramme',
    text: 'Un ECG réalisé à votre adresse par un professionnel habilité.',
    tag: 'À DOMICILE',
  },
  {
    icon: Video,
    name: 'Téléconsultation',
    text: 'Échangez avec un médecin dans une salle vidéo privée.',
    tag: 'À DISTANCE',
  },
];
const faqs = [
  [
    'Comment demander un soin ?',
    'Créez votre compte, choisissez un service, indiquez le bénéficiaire, l’adresse et le créneau souhaité. La coordination vérifie la disponibilité et vous informe dans votre espace.',
  ],
  [
    'Puis-je demander un soin pour un proche ?',
    'Oui. Ajoutez un proche à votre carnet de bénéficiaires en confirmant que vous êtes autorisé à gérer sa demande.',
  ],
  [
    'Quand dois-je payer ?',
    'Après la réalisation des soins. Le devis est confirmé avant la fin de l’intervention. Les moyens de paiement disponibles sont indiqués sur votre facture.',
  ],
  [
    'Est-ce un service d’urgence médicale ?',
    'Une demande sur la plateforme ne garantit pas une intervention immédiate. En cas de danger immédiat, contactez les services d’urgence locaux ou rendez-vous au service d’urgence le plus proche.',
  ],
  [
    'Comment mes données sont-elles protégées ?',
    'Votre espace nécessite une connexion. Les dossiers sont limités aux personnes autorisées, les justificatifs restent privés et les actions sensibles sont tracées. Consultez notre page de confidentialité pour les limites de la version de développement.',
  ],
];
export default function Home() {
  return (
    <>
      <div className="topline">
        <div className="container">
          <span>
            <MapPin size={13} /> Des soins de proximité au Bénin
          </span>
          <a href="tel:+2290196751075">
            <Phone size={13} /> +229 01 96 75 10 75
          </a>
        </div>
      </div>
      <header className="public-header container">
        <Brand />
        <nav aria-label="Navigation principale">
          <a href="#services">Nos services</a>
          <a href="#fonctionnement">Comment ça marche</a>
          <a href="#tarifs">Tarifs</a>
          <a href="#contact">Contact</a>
        </nav>
        <Link className="btn btn-outline header-login" href="/connexion">
          Mon espace <ArrowUpRight size={16} />
        </Link>
      </header>
      <main id="main">
        <section className="hero container">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="dot" /> LA SANTÉ, PLUS PROCHE DE VOUS
            </div>
            <h1>
              Le bon soin.
              <br />
              <em>Au bon endroit.</em>
            </h1>
            <p>
              À domicile, au bureau ou à distance, prenez soin de vous et de vos proches. Nous vous aidons à
              organiser votre prise en charge.
            </p>
            <div className="hero-actions">
              <Link className="btn" href="/espace?nouveau=1">
                Demander un soin <ArrowRight size={18} />
              </Link>
              <a className="text-link" href="#services">
                Découvrir les services <ArrowUpRight size={17} />
              </a>
            </div>
            <div className="hero-assurance">
              <span>
                <ShieldCheck size={17} /> Espace personnel sécurisé
              </span>
              <span>
                <Check size={17} /> Paiement après les soins
              </span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-circle" />
            <div className="hero-photo">
              <img
                src="/sos-docteurs-affiche.jpeg"
                alt="Équipe médicale de l’affiche SOS DOCTEURS fournie par l’organisation"
                width="762"
                height="1080"
                fetchPriority="high"
              />
            </div>
            <div className="photo-caption">
              <span className="icon-tile">
                <House size={22} />
              </span>
              <div>
                <strong>Votre santé, notre mission.</strong>
                <small>Le soin vient à vous.</small>
              </div>
            </div>
            <div className="floating-label">
              <ShieldCheck size={18} /> Une demande, un suivi
            </div>
            <span className="visual-plus plus-one" aria-hidden="true">
              +
            </span>
            <span className="visual-plus plus-two" aria-hidden="true">
              +
            </span>
            <span className="visual-caption">SOS DOCTEURS · BÉNIN</span>
          </div>
        </section>
        <div className="confidence-strip">
          <div className="container confidence-inner">
            <div>
              <Clock3 />
              <span>
                Une demande à tout moment<small>Disponibilité à confirmer</small>
              </span>
            </div>
            <div>
              <House />
              <span>
                Chez vous ou au bureau<small>À l’adresse de votre choix</small>
              </span>
            </div>
            <div>
              <CalendarDays />
              <span>
                Un suivi à chaque étape<small>Dans votre espace personnel</small>
              </span>
            </div>
            <div>
              <ShieldCheck />
              <span>
                Pour vous et vos proches<small>Des accès maîtrisés</small>
              </span>
            </div>
          </div>
        </div>
        <section id="services" className="section container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">NOS SERVICES</p>
              <h2>
                Des soins pensés
                <br />
                pour votre quotidien.
              </h2>
            </div>
            <p className="section-intro">
              Moins de déplacements, plus de sérénité.
              <br />
              Choisissez le soin dont vous avez besoin.
            </p>
          </div>
          <div className="service-grid">
            {services.map((s, i) => (
              <Link className="service-card" href={'/espace?nouveau=1&service=' + i} key={s.name}>
                <div className="service-card-top">
                  <span className="icon-tile">
                    <s.icon size={25} strokeWidth={1.5} />
                  </span>
                  <ArrowUpRight size={20} />
                </div>
                <h3>{s.name}</h3>
                <p>{s.text}</p>
                <span className="service-tag">{s.tag}</span>
              </Link>
            ))}
          </div>
        </section>
        <section id="fonctionnement" className="how-section">
          <div className="container">
            <div className="section-heading">
              <div>
                <p className="eyebrow">SIMPLE, DU DÉBUT À LA FIN</p>
                <h2>
                  Votre parcours de soins,
                  <br />
                  en toute clarté.
                </h2>
              </div>
              <Link className="text-link" href="/connexion?mode=inscription">
                Créer mon compte <ArrowUpRight size={18} />
              </Link>
            </div>
            <div className="steps">
              {[
                [
                  '01',
                  'Vous faites la demande',
                  'Choisissez le soin, le bénéficiaire et le lieu. Indiquez le créneau qui vous convient.',
                ],
                [
                  '02',
                  'Nous organisons la prise en charge',
                  'La coordination recherche un professionnel disponible et confirme les détails.',
                ],
                [
                  '03',
                  'Vous recevez vos soins',
                  'Suivez les étapes dans votre espace et réglez votre facture après les soins.',
                ],
              ].map(([n, title, text]) => (
                <div className="step" key={n}>
                  <span>{n}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section id="tarifs" className="section container pricing-section">
          <div>
            <p className="eyebrow">DES TARIFS CLAIRS</p>
            <h2>
              Vous savez où vous allez.
              <br />
              <em>Avant de payer.</em>
            </h2>
            <p>
              Le tarif dépend du soin demandé et de votre prise en charge. Votre devis est confirmé par la
              coordination. Le paiement intervient après les soins réalisés.
            </p>
            <div className="payment-brands">
              <span>MTN MoMo</span>
              <span>Moov Money</span>
              <span>Celtiis Cash</span>
            </div>
            <small>Moyens de paiement selon activation du prestataire.</small>
          </div>
          <div className="pricing-card">
            <span className="icon-tile">
              <ShieldCheck size={28} />
            </span>
            <h3>
              Une prise en charge,
              <br />
              sans mauvaise surprise.
            </h3>
            <ul>
              <li>
                <Check /> Un devis accessible dans votre espace
              </li>
              <li>
                <Check /> Une disponibilité confirmée
              </li>
              <li>
                <Check /> Un paiement après l’intervention
              </li>
              <li>
                <Check /> Une facture à retrouver à tout moment
              </li>
            </ul>
            <Link className="btn" href="/espace?nouveau=1">
              Organiser mes soins <ArrowRight size={18} />
            </Link>
          </div>
        </section>
        <section className="faq-section container">
          <div>
            <p className="eyebrow">ON VOUS RÉPOND</p>
            <h2>
              Les questions
              <br />
              que vous vous posez.
            </h2>
            <p>
              Besoin d’un échange ?<br />
              <a href="tel:+2290196751075" className="text-link">
                Appelez-nous <ArrowUpRight size={16} />
              </a>
            </p>
          </div>
          <div className="faq-list">
            {faqs.map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <ChevronDown size={19} />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section id="contact" className="contact-banner container">
          <div>
            <p className="eyebrow">NOUS SOMMES À VOTRE ÉCOUTE</p>
            <h2>
              Et si on prenait
              <br />
              soin de vous ?
            </h2>
            <p>Parlez-nous de votre besoin. Nous vous aidons à trouver la suite.</p>
          </div>
          <div>
            <a href="tel:+2290196751075" className="contact-phone">
              <Phone size={24} /> +229 01 96 75 10 75
            </a>
            <div className="contact-other">
              <a href="tel:+2290155206060">01 55 20 60 60</a>
              <span>·</span>
              <a href="tel:+2290141808080">01 41 80 80 80</a>
            </div>
            <Link href="/espace?nouveau=1" className="btn btn-white">
              Faire une demande <MoveRight size={18} />
            </Link>
          </div>
        </section>
      </main>
      <footer className="container footer">
        <Brand />
        <p>Votre santé, notre mission.</p>
        <div>
          <Link href="/confidentialite">Confidentialité</Link>
          <a href="/sos-docteurs-affiche.jpeg" target="_blank" rel="noreferrer">
            Notre présentation
          </a>
        </div>
        <small>© {new Date().getFullYear()} SOS DOCTEURS</small>
      </footer>
    </>
  );
}
