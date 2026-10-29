# SOS DOCTEURS

> État de cette copie au 29 octobre 2026 : les contrats partagés, plusieurs scripts et les premiers tests ont été reconstruits après constat de fichiers manquants. L'installation des dépendances a été interrompue lors de la déconnexion du lecteur de travail. Les nouveaux tests et la compilation ne sont pas encore validés ; aucun APK ni déploiement public n'a été produit pendant cette reconstruction. Les résultats du rapport du 27 octobre concernent la livraison précédente.

Plateforme de soins à domicile pour le Bénin : site public, espaces client/professionnel/coordination/administration, API NestJS et application Android Expo. Identité issue des affiches fournies et du skill UI/UX Pro Max. Le logiciel utilise la même API et les mêmes règles d’accès sur web et mobile.

## Démarrer sur cet ordinateur

Prérequis : Node 24, npm, PostgreSQL 16. Android Studio est installé. Depuis le dossier SOS, dans PowerShell :

```powershell
npm.cmd ci
npm.cmd run setup
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/postgres-local.ps1
npm.cmd run db:seed
npm.cmd run dev
```

Le script setup préserve une configuration existante. La base locale du projet écoute uniquement sur 127.0.0.1:55432 ; elle est indépendante du service PostgreSQL installé. Les migrations sont appliquées par db:seed en développement. Web : http://localhost:3000 ; API : http://localhost:4000/api ; Swagger de développement : http://localhost:4000/api/docs.

## Démonstration

Mot de passe des comptes fictifs : **Demo-SOS-2026!**. Ils sont créés uniquement quand DEMO_MODE=true hors production.

| Espace         | Adresse                    |
| -------------- | -------------------------- |
| Patient        | patient@demo.sos.test      |
| Autre client   | proche@demo.sos.test       |
| Médecin        | medecin@demo.sos.test      |
| Infirmier      | infirmier@demo.sos.test    |
| Coordination   | coordination@demo.sos.test |
| Administration | admin@demo.sos.test        |

Les tarifs initiaux sont « sur devis ». Aucun prix du catalogue n’est présenté comme un tarif officiel. Les zones initiales Cotonou, Abomey-Calavi et Porto-Novo sont modifiables par l’administration.

Parcours : demander un soin comme patient ; ouvrir la demande en coordination, fixer et confirmer le devis, rechercher puis affecter un professionnel disponible ; accepter la mission comme professionnel et faire progresser son suivi jusqu’à « terminée » ; payer la facture depuis le compte patient. En démo, la simulation est explicitement indiquée et ne transfère aucun argent. Les remboursements simulés sont réservés à l’administration.

## Android

Le projet natif se trouve dans [apps/mobile/android](apps/mobile/android). Ouvrir ce dossier dans Android Studio. [Guide Android](docs/ANDROID.md) : serveur local, permissions, Gradle, signature de production et EAS. Un bundle Hermes a été exporté dans artifacts/mobile-bundle ; il ne s’agit pas d’un APK. L’état réel de la compilation est consigné dans [le rapport de vérification](docs/VERIFICATION.md).

```powershell
npm.cmd run dev:mobile
npm.cmd run android:prebuild
npm.cmd run android:apk
```

## Organisation

| Dossier            | Contenu                                                      |
| ------------------ | ------------------------------------------------------------ |
| apps/api           | API NestJS, TypeORM, migrations et logique métier            |
| apps/web           | Next.js, site public et espaces par rôle                     |
| apps/mobile        | Application unique Expo/React Native et projet Android       |
| packages/contracts | Types, schémas de validation et transitions partagés         |
| tests              | Intégration PostgreSQL et parcours navigateur                |
| scripts            | Configuration locale, Android et exploitation                |
| design-system      | Direction visuelle SOS DOCTEURS                              |
| docs               | Architecture, intégrations, sécurité, déploiement et OpenAPI |

## Vérifications

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
npm.cmd test
npm.cmd run test:e2e
npm.cmd run build
```

Les tests d’intégration utilisent exclusivement une base dont le nom se termine par _test, séparée de la base de démonstration. Le compte PostgreSQL de test doit pouvoir la créer ou recevoir TEST_DATABASE_URL. Les tests E2E créent des données explicitement fictives dans la base de démonstration ; ne jamais les diriger vers des données réelles.

## Documents

- [Architecture et droits](docs/ARCHITECTURE.md)
- [Configuration des fournisseurs](docs/INTEGRATIONS.md)
- [Sécurité et confidentialité](docs/SECURITY.md)
- [Déploiement et exploitation](docs/DEPLOYMENT.md)
- [Android Studio et APK](docs/ANDROID.md)
- [Résultats et limites vérifiés](docs/VERIFICATION.md)
- [Contrat OpenAPI](docs/openapi.json)

Les paiements marchands, la vidéo, les notifications externes, l’IA et S3 nécessitent les comptes et secrets décrits dans la documentation. Le projet n’est pas certifié pour une exploitation médicale en production : validation métier, juridique, sécurité et essais avec les fournisseurs réels restent nécessaires.
