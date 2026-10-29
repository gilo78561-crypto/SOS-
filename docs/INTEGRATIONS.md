# Fournisseurs et configuration

## Paiements MTN, Moov et Celtiis

Les trois adaptateurs utilisent l’API REST FedaPay et une page de paiement hébergée. Le choix du canal final dépend des moyens activés sur le compte marchand et de la page du prestataire. Il n’existe pas de connexion directe aux API privées de chaque opérateur dans ce projet.

Configurer PAYMENT_MODE=fedapay, FEDAPAY_ENVIRONMENT=sandbox, FEDAPAY_SECRET_KEY et FEDAPAY_WEBHOOK_SECRET. Enregistrer le webhook HTTPS POST /api/webhooks/fedapay dans le tableau marchand. Pour une exploitation réelle, utiliser live et les identifiants correspondants. PUBLIC_API_URL et WEB_ORIGIN doivent correspondre aux domaines HTTPS déployés. Ne jamais exposer ces clés via NEXT_PUBLIC ou EXPO_PUBLIC.

Création de transaction, génération du jeton de paiement et lecture du statut sont côté serveur. La signature HMAC utilise le corps brut et le format t=horodatage,s=signature, avec une tolérance de cinq minutes. Le serveur compare ensuite le montant XOF, l’identifiant de transaction et le statut fourni par l’API marchande. Un succès dans l’URL de retour est ignoré. Aucun PIN Mobile Money n’est demandé ni stocké.

Les tests utilisent un faux prestataire déclaré en développement et des réponses marchandes contrôlées. Aucune transaction avec un compte marchand réel n’a été effectuée. Avant activation : vérifier les réponses sandbox du compte, tester les trois canaux, refus, expiration, webhook répété, montant incorrect et rapprochement. Une création distante dont le résultat est incertain bloque une nouvelle initiation automatique et nécessite un rapprochement. Un remboursement réel ouvre un dossier manual_review : le transfert d’argent et sa confirmation marchande restent manuels.

Références officielles : [transactions](https://docs.fedapay.com/api-reference/transactions/create), [jeton de paiement](https://docs.fedapay.com/api-reference/transactions/create-token), [moyens de paiement](https://docs.fedapay.com/fr/payment-methods).

## Cartographie

Le web propose une carte avec sélection par clic ou au clavier, déplacement, zoom et attribution. Elle charge les tuiles uniquement après accord. La localisation GPS facultative et l’adresse manuelle fonctionnent indépendamment. Android propose actuellement GPS facultatif, adresse manuelle et ouverture d’itinéraire ; le sélecteur de carte natif reste à intégrer.

L’interface MapProvider se trouve dans apps/web/lib/maps.ts. Variables de build : NEXT_PUBLIC_MAP_PROVIDER=disabled pour masquer la carte ; NEXT_PUBLIC_MAP_TILE_URL pour un modèle HTTPS avec {z}/{x}/{y}, NEXT_PUBLIC_MAP_ATTRIBUTION et NEXT_PUBLIC_MAP_ATTRIBUTION_URL pour un fournisseur alternatif. Par défaut : OpenStreetMap. La CSP n’autorise que l’origine configurée pour les images. Modifier ces variables exige une nouvelle compilation web. MAP_PROVIDER côté serveur est une réserve de configuration et ne sélectionne pas un SDK Android.

Les tuiles ne reçoivent aucune description de soins ni identifiant de patient. Elles révèlent toutefois l’adresse IP et la zone consultée : l’information et l’accord sont affichés avant chargement. Le navigateur respecte le cache et le Referer ; aucune carte hors ligne ou collecte de tuiles n’est réalisée. Le service communautaire est sans garantie de disponibilité et doit être remplacé par une offre adaptée en cas de charge élevée. [Politique officielle OSM](https://operations.osmfoundation.org/policies/tiles/).

## Vidéo Daily

Renseigner DAILY_API_KEY côté serveur. La réservation de téléconsultation utilise un service du catalogue, le consentement et une fenêtre horaire contrôlée. Les salles privées et jetons temporaires sont créés par le serveur et réservés aux participants autorisés. Sans clé, l’interface annonce l’indisponibilité de la vidéo réelle. Aucun appel réel Daily n’a été testé. Vérifier microphones/caméras, expiration, accès tiers refusé et fermeture de salle avant diffusion.

## Notifications

L’application dispose de notifications internes persistées. Les préférences e-mail/SMS/push sont soumises à consentement. Les messages externes contiennent uniquement une invitation à consulter l’espace sécurisé.

E-mail : RESEND_API_KEY et MAIL_FROM avec domaine validé. SMS : SMS_WEBHOOK_URL HTTPS et SMS_WEBHOOK_TOKEN, vers une passerelle privée acceptant {to,text} et Idempotency-Key. Push : jeton Expo de l’appareil via /preferences et EXPO_ACCESS_TOKEN si la sécurité renforcée est activée. L’enregistrement automatique d’un jeton push sur appareil et le suivi des reçus de livraison restent à compléter. Les échecs sont conservés, trois tentatives au maximum. La coordination déclenche l’envoi ; aucun ordonnanceur distribué n’est installé. « sent » signifie accepté par la passerelle, pas preuve de réception. Aucun fournisseur externe n’a été testé avec de vraies destinations.

## Assistant informatif

Sans clé, un guide local répond honnêtement en mode sans IA. Le repérage de signaux d’alarme oriente immédiatement vers les services d’urgence locaux sans inventer de numéro. Il n’effectue ni diagnostic ni prescription.

L’adaptateur serveur OpenAI Responses nécessite AI_ENABLED=true, OPENAI_API_KEY et OPENAI_MODEL. Il envoie uniquement une consigne prédéfinie d’explication des services. Le texte libre saisi par le client et ses données identifiantes ne sont jamais transmis. Aucun appel IA réel n’a été exécuté. Faire valider les messages par des professionnels compétents avant usage public.

## Documents privés

Le stockage local chiffré AES-GCM est opérationnel et contrôlé par l’API. Pour S3 compatible : STORAGE_ENDPOINT HTTPS, STORAGE_REGION, STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID et STORAGE_SECRET_ACCESS_KEY. Le bucket doit être privé, sans accès public ni journalisation de données sensibles. Les noms de clés sont aléatoires. Aucun lien public n’est généré. Les clés de chiffrement restent hors bucket. L’adaptateur S3 n’a pas été testé sur un compte réel.
