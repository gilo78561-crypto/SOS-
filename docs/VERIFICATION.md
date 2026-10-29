# Rapport de livraison — 27 octobre 2026

## État

Le dépôt initialement vide contient maintenant un monorepo exécutable : Next.js, NestJS, PostgreSQL/TypeORM et application Expo/React Native avec projet Android généré. La conception utilise le skill UI/UX Pro Max et l’identité verte/rouge des affiches fournies. Les dépendances sont installées et verrouillées. Le logiciel n’est pas déclaré prêt pour l’exploitation médicale en production.

## Résultats réellement obtenus sur ce poste

| Contrôle                                         | Résultat                                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| Lint ESLint sans avertissement                   | Réussi                                                                          |
| Types API, web, mobile et contrats               | Réussi                                                                          |
| Formatage Prettier                               | Appliqué et contrôlé                                                            |
| Tests d’intégration sur PostgreSQL dédié         | **31 tests réussis**                                                            |
| Parcours Playwright sur serveur de développement | **4 tests réussis**                                                             |
| Mêmes parcours sur le web compilé                | **4 tests réussis**, 10,2 secondes                                              |
| Build API et Next.js de production               | Réussi, code de sortie 0                                                        |
| Audit npm des dépendances installées             | **0 vulnérabilité signalée** au contrôle du 27 octobre 2026                     |
| Sauvegarde/restauration PostgreSQL locale        | Réussie : **27 tables**, comptages et empreintes des fichiers privés identiques |
| Compatibilité des dépendances Expo               | expo install --check réussi                                                     |
| Projet Android natif                             | expo prebuild --platform android réussi                                         |
| Bundle Android Hermes                            | Exporté réellement, environ 3,1 Mo, 784 modules                                 |
| APK installable                                  | **Non généré**                                                                  |
| Docker, CI distante et branche PostGIS réelle    | Fournis, non exécutés ici                                                       |
| Android sur téléphone/émulateur et TalkBack      | Non testés                                                                      |

Les tests API couvrent mots de passe, sessions, CSRF, suspension et reset ; isolation entre clients, bénéficiaires et professionnels ; justificatifs avant validation ; transitions des soins ; refus/réaffectation et concurrence ; absence de double réservation ; facture unique ; paiements idempotents ; faux montant/signature rejetés ; vérification marchande contrôlée ; remboursement ; documents privés ; audit, support, garde-fous sans IA ; paramètres, disponibilités hebdomadaires, relance et export personnel.

Les quatre tests web couvrent accueil responsive et liens, demande patient et bénéficiaire, sélection du point sur carte, navigation coordination sur petit écran, vérification professionnelle et audit administrateur. Les tuiles de carte sont remplacées par une image contrôlée dans les tests : aucun robot ne parcourt le serveur OSM. Ces quatre parcours ne constituent pas un audit exhaustif de tous les écrans ni un essai Android.

Le bundle réel est sous artifacts/mobile-bundle/_expo/static/js/android/index-b1d77ffc08186208b7925924a4d18d68.hbc. Il ne s’installe pas sur un téléphone. Les captures web sont dans artifacts/ et le rapport navigateur sous playwright-report/.

Les journaux locaux ignorés sont conservés sous .data : tests-api.log, tests-e2e.log, tests-e2e-production.log, typecheck.log, lint.log, format.log, build.log, dependency-audit.json et android-build.log. La preuve de restauration est sous .data/backups/2026-10-27T11-33-40-551Z/restore-verification.json. Aucune donnée réelle de patient n’a été importée.

## Ce qui fonctionne localement

Authentification, rôles et accès serveur ; inscription client/professionnel ; validation/suspension ; bénéficiaires autorisés ; catalogue administrable et tarifs sur devis ; disponibilités ; demande, recherche, affectation et suivi des soins ; notes restreintes et documents privés ; devis/facture après soins ; paiement et remboursement explicitement fictifs en démo ; support ; audit ; notifications internes ; consentements ; guide sans IA ; paramètres de coordination ; sauvegarde et restauration locale.

Le web de démonstration est accessible sur http://localhost:3000 tant que les processus locaux restent actifs. Identifiants et redémarrage sont décrits dans README.md. L’API est sur http://localhost:4000/api. La version compilée du web est servie localement ; la configuration et la base restent celles de développement, avec données fictives.

## Android : blocage concret

Android Studio installé et son SDK ont été détectés ; le projet natif a été généré. Le JDK 17 portable a été téléchargé avec vérification SHA-256. Les tentatives Gradle ont rencontré d’abord des problèmes de compatibilité/ressources, puis un manque de mémoire native confirmé dans apps/mobile/android/hs_err_pid6576.log. Après réduction du tas Gradle à 1 Go et un worker, la dernière tentative a échoué pendant compileKotlin avec « Espace insuffisant sur le disque » dans .data/android-build.log.

Le disque a également empêché une écriture de documentation ; seuls des caches régénérables créés dans ce projet ont été nettoyés pour terminer la livraison. La machine dispose d’environ 7 Go de RAM. La plateforme 36 et les composants natifs demandés par Gradle devront être installés si absents. Aucun fichier APK n’existe dans artifacts ni dans les sorties attendues. Aucune installation sur appareil n’est revendiquée. Voir ANDROID.md pour reprendre la compilation sur un environnement disposant de plusieurs Go libres et d’assez de mémoire, ou via EAS avec le compte du propriétaire.

## Intégrations partielles et travail restant

| Élément                    | Livré                                                                          | À connecter ou vérifier                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| MTN/Moov/Celtiis           | Adaptateurs FedaPay REST, idempotence, HMAC et rapprochement serveur           | Compte marchand, clés sandbox/live, activation des canaux, essais marchands réels                                      |
| Remboursements             | Démo automatisée ; dossier de revue en réel                                    | Transfert marchand réel et confirmation comptable                                                                      |
| Vidéo                      | Réservation, consentement, fournisseur Daily, salles privées et jetons serveur | Compte/clé et essais réels des participants                                                                            |
| Notifications              | Interne ; préférences et adaptateurs e-mail/SMS/push, échecs conservés         | Domaines et comptes, enregistrement push sur appareil, reçus et ordonnanceur                                           |
| IA                         | Guide local et garde-fous ; adaptateur Responses sans texte libre de patient   | Clé/modèle, validation clinique et essais réels                                                                        |
| S3                         | Interface privée et chiffrement applicatif                                     | Bucket, clés, droits, test de restauration objets                                                                      |
| Carte                      | Sélection web, consentement, GPS facultatif et itinéraire externe              | Sélecteur natif, fournisseur dimensionné, test cartographique réel et PostGIS                                          |
| Professionnels             | Historique et montants bruts facturés                                          | Contrats, répartition/commissions et versements réels                                                                  |
| Disponibilités habituelles | Génération hebdomadaire API ; saisie de périodes web/mobile                    | Éditeur de récurrence complet dans les interfaces                                                                      |
| Conservation/effacement    | Consentements, export personnel et échéance de revue                           | Politique validée et procédure d’effacement/anonymisation automatisée                                                  |
| Production                 | Dockerfiles, Compose, CI, procédures, contrôles HTTPS et secrets               | Hébergeur/domaine, TLS, stockage, privilèges DB, restauration hors site, audit indépendant et validation réglementaire |

Les listes opérationnelles sont bornées/paginées pour limiter les données chargées. Les filtres de demandes web portent sur la page affichée ; le tableau de bord l’indique pour ses sous-totaux. Le récapitulatif professionnel porte sur les 200 dernières missions terminées et n’est pas un livre de paie.

Les accès marchands, clés vidéo/notification/IA/S3, compte Expo, signature de distribution, domaine et arbitrages métier/juridiques n’ont pas été fournis. Aucun succès de service externe, certification de conformité, versement réel ou déploiement public n’est revendiqué.
