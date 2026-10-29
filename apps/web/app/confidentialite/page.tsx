import Link from 'next/link';
import { Brand } from '../../components/brand';
export default function Privacy() {
  return (
    <>
      <header className="container public-header">
        <Brand />
        <Link href="/" className="btn btn-outline">
          Accueil
        </Link>
      </header>
      <main id="main" className="container prose">
        <p className="eyebrow">VOTRE ESPACE, VOS DONNÉES</p>
        <h1>Confidentialité</h1>
        <p>
          Cette version de développement de SOS DOCTEURS utilise des données fictives lorsque le mode de
          démonstration est activé. N’y saisissez pas de dossier médical réel avant la validation de
          l’hébergement, des procédures et des autorisations réglementaires.
        </p>
        <h2>Données et finalités</h2>
        <p>
          Le compte conserve les coordonnées nécessaires à la prise en charge. Les demandes utilisent le
          service, le bénéficiaire autorisé, le lieu et le créneau souhaités. Les descriptions, adresses,
          notes de soins et justificatifs privés sont chiffrés par l’application.
        </p>
        <h2>Accès</h2>
        <p>
          Un patient voit ses demandes et ses bénéficiaires. Un soignant vérifié voit les missions qui lui
          sont attribuées. La coordination dispose des informations nécessaires à l’organisation. Les notes
          cliniques ne sont pas accessibles à la coordination ni à l’administrateur par défaut. Les accès
          sensibles sont journalisés.
        </p>
        <h2>Prestataires et consentement</h2>
        <p>
          La géolocalisation est facultative. Vous pouvez saisir une adresse manuellement. Les messages
          externes ne contiennent pas de données de santé. L’assistant ne transmet pas votre texte libre aux
          services d’IA : seules des explications administratives prédéfinies peuvent être traitées. La vidéo
          et les paiements nécessitent l’activation de prestataires distincts.
        </p>
        <h2>Vos demandes</h2>
        <p>
          Utilisez le support dans votre espace pour une demande d’accès, de rectification ou de suppression.
          La durée de conservation, le responsable de traitement et les voies de recours doivent être précisés
          avant l’ouverture au public. La conformité n’est pas certifiée par cette version logicielle.
        </p>
        <h2>Besoin urgent</h2>
        <p>
          La plateforme ne remplace pas les services d’urgence. En cas de danger immédiat, contactez les
          services d’urgence locaux ou rendez-vous au service d’urgence le plus proche.
        </p>
        <Link className="btn" href="/espace">
          Ouvrir mon espace
        </Link>
      </main>
    </>
  );
}
