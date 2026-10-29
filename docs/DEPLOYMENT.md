# Installation et exploitation

## Environnements

Développement : configuration locale générée par npm run setup, comptes fictifs et paiements de test explicitement activés. Tests : base dédiée *_test, clés factices et aucun envoi externe. Production : domaine et API HTTPS, DEMO_MODE=false, paiement disabled ou fedapay live, PostGIS obligatoire, stockage privé, secrets et signature propres.

Consulter .env.example pour les variables. NODE_ENV, PORT, DATABASE_URL, DB_SSL, DATA_ENCRYPTION_KEY, WEB_ORIGIN et PUBLIC_API_URL concernent le serveur. NEXT_PUBLIC_* et EXPO_PUBLIC_* sont publics et intégrés aux builds : ne jamais y placer de secret. TEST_DATABASE_URL est strictement une base de test.

## Docker Compose

Docker n’était pas installé sur ce poste ; ces images et la CI sont fournies mais n’ont pas été exécutées ici. POSTGRES_PASSWORD doit être une valeur forte dans l’environnement privé. Pour la base de développement : docker compose up -d db, puis configurer DATABASE_URL pour le port 5432. Cette base PostGIS est distincte de la base Windows locale 55432.

Les profils app construisent API et web. Avant production : copier .env.example vers une configuration privée, fournir domaines HTTPS, clé AES et mot de passe DB, désactiver la démo et les paiements test, choisir les fournisseurs. Le seed en production installe seulement le catalogue initial, sans utilisateurs fictifs.

```sh
docker compose --profile app build
docker compose up -d db
docker compose --profile app run --rm api node apps/api/dist/cli.js migrate
docker compose --profile app run --rm api node apps/api/dist/cli.js seed
docker compose --profile app up -d api web
```

Le compte DB fourni par l’image est un compte d’initialisation. Pour une exploitation réelle, provisionner un compte de migration et un rôle applicatif minimal, puis adapter DATABASE_URL et les droits au lieu de conserver le compte initial. Le serveur ne lance pas automatiquement les migrations en production.

Placer un reverse proxy TLS devant les ports loopback 3000/4000 et router /api vers l’API. Adapter les domaines CORS et cookies au déploiement choisi. Ne pas exposer DB ni bucket. Gérer les certificats, supervision, journaux sans données de santé et renouvellements. Les images s’exécutent avec le compte node. Les volumes doivent être chiffrés et privés.

## Premier administrateur

Aucun rôle élevé ne peut être demandé à l’inscription. Dans un terminal privé avec ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD (12 caractères minimum) et ADMIN_PHONE au format +22901XXXXXXXX : npm run bootstrap:admin. La commande refuse s’il existe déjà un administrateur. Pour la coordination : npm run bootstrap:operator. Ne jamais mettre ces valeurs dans une commande partagée, une capture ou un fichier versionné. Sur Docker, passer les variables par un gestionnaire de secrets et exécuter node apps/api/dist/cli.js bootstrap-admin dans le conteneur préparé.

## Sauvegarde et restauration

npm run db:backup produit un archive pg_dump custom, une copie des fichiers privés locaux déjà chiffrés et un manifeste SHA-256 sous .data/backups/date. PG_BIN permet de choisir les outils PostgreSQL. La clé AES n’est jamais incluse. Un bucket S3 nécessite une sauvegarde/version du bucket séparée. Les archives contiennent aussi des données de compte : elles doivent rester privées et être chiffrées au niveau du support de sauvegarde, avec accès restreint. La copie locale ignorée dans Git sert au développement, pas de stratégie hors site.

```powershell
npm run db:restore:test
```

Ce contrôle n’opère que sur PostgreSQL local hors production : crée une base isolée au suffixe _restore_test, restaure l’archive, compare le nombre de lignes des tables publiques et les empreintes des fichiers privés, écrit restore-verification.json puis supprime uniquement cette base temporaire. Ne pas lancer pendant des écritures concurrentes. La vérification locale du 27 octobre 2026 a réussi sur les 27 tables. Elle ne prouve pas la restauration de S3 ni d’un hébergement de production.

Pour un incident réel : arrêter les écritures, restaurer l’archive dans une nouvelle base isolée avec pg_restore --exit-on-error --no-owner --no-acl, restaurer la version correspondante des objets privés et la clé AES conservée séparément, contrôler comptages/intégrité/déchiffrement et accès, valider le point de reprise, puis basculer la configuration. Répéter périodiquement avec une sauvegarde hors site et documenter les objectifs de perte de données et de reprise. Ne pas écraser directement une base active.

## CI

.github/workflows/ci.yml installe les dépendances verrouillées, utilise PostGIS, exécute types/lint/format/tests/build/E2E puis conserve les captures. Aucune exécution distante n’a été déclenchée. Dependabot est configuré. Une construction Android signée doit être ajoutée sur un runner doté des ressources et secrets adaptés.

## Dépannage

Connexion DB refusée : démarrer la base choisie et vérifier le port ; ne pas mélanger 55432 Windows et 5432 Docker. Erreur de chiffrement : rétablir la clé exacte, jamais en générer une nouvelle sur les données existantes. Carte indisponible : continuer avec l’adresse et le GPS facultatif. Paiement non configuré : vérifier le mode et les clés côté serveur, jamais simuler en production. Android : voir ANDROID.md ; disque ou mémoire insuffisants exigent des ressources disponibles avant relance.
