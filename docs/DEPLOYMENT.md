# Installation et exploitation

## Environnements

Développement : configuration locale générée par npm run setup, comptes fictifs et paiements de test explicitement activés. Tests : base dédiée *_test, clés factices et aucun envoi externe. Production : domaine et API HTTPS, DEMO_MODE=false, paiement disabled ou fedapay live, PostGIS obligatoire, stockage privé, secrets et signature propres.

Consulter .env.example pour les variables. NODE_ENV, PORT, DATABASE_URL, DB_SSL, DATA_ENCRYPTION_KEY, WEB_ORIGIN et PUBLIC_API_URL concernent le serveur. NEXT_PUBLIC_* et EXPO_PUBLIC_* sont publics et intégrés aux builds : ne jamais y placer de secret. TEST_DATABASE_URL est strictement une base de test.

## Vercel : site web et API

Un seul projet Vercel sert maintenant le site et l'API NestJS sous le même domaine : /api/health, /api/auth/login, etc. Le navigateur utilise /api par défaut. Les cookies de session restent sur ce domaine. L'adaptateur Next.js conserve le corps brut des requêtes pour les signatures des webhooks et initialise l'API une seule fois par instance. En cas d'échec de connexion à la base, il répond HTTP 503 sans divulguer les secrets, puis permet une nouvelle tentative.

Pour ce projet, laisser **Root Directory à la racine du dépôt** et choisir **Framework Preset = Next.js**, avec Node.js 24.x. Le fichier vercel.json installe les workspaces web, api et contracts, compile l'API avant le site et utilise apps/web/.next comme sortie. La configuration de apps/web reste utilisable pour un projet dont Root Directory est apps/web ; activer alors l'accès aux fichiers hors du Root Directory.

L'installation utilise npm ci --include=dev --include-workspace-root --workspace=@sos/web --workspace=@sos/api --workspace=@sos/contracts. Ne pas ajouter cd ../.. : cette commande sortirait du dépôt lorsque Vercel lance déjà l'installation à sa racine. Après un push, vérifier que Vercel déploie le nouveau commit de main. Une ancienne commande d'installation indique un ancien commit ou des paramètres de projet à corriger.

Configurer les variables suivantes sur **le projet Vercel du site**, dans chaque environnement concerné :

| Variable            | Valeur ou rôle                                                                                                                                                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DATABASE_URL        | Connexion privée PostgreSQL hébergée, avec PostGIS ; une connexion poolée convient aux fonctions.                                                                                                                                                  |
| DB_SSL              | true pour la base hébergée avec vérification du certificat.                                                                                                                                                                                        |
| DATA_ENCRYPTION_KEY | Clé aléatoire privée de 32 octets, encodée en 64 caractères hexadécimaux. Conserver cette clé pour pouvoir relire les données chiffrées.                                                                                                           |
| WEB_ORIGIN          | Origine HTTPS exacte du site, sans chemin ; facultative avec les variables système Vercel. La production utilise VERCEL_PROJECT_PRODUCTION_URL, les previews VERCEL_URL. Adapter cette variable séparément si un domaine personnalisé est utilisé. |
| PUBLIC_API_URL      | Origine HTTPS de l'API, ici celle du site ; facultative, utilise WEB_ORIGIN par défaut.                                                                                                                                                            |
| NEXT_PUBLIC_API_URL | /api, ou laisser absent ; supprimer toute ancienne valeur localhost.                                                                                                                                                                               |
| DEMO_MODE           | false                                                                                                                                                                                                                                              |
| PAYMENT_MODE        | disabled tant qu'un fournisseur réel n'est pas configuré.                                                                                                                                                                                          |

Créer une base PostgreSQL dédiée avec PostGIS (Neon prend en charge cette extension). Avec la connexion directe et les secrets injectés dans un environnement privé, lancer npm run db:migrate puis npm run db:seed en NODE_ENV=production. Les migrations installent les extensions disponibles ; PostGIS est obligatoire en production. Le seed de production ajoute le catalogue, sans comptes fictifs. Les requêtes HTTP n'exécutent pas les migrations en production. Ne jamais placer les secrets dans GitHub, les variables NEXT_PUBLIC_* ou un journal de build. Redéployer après modification des variables Vercel.

Vérifier ensuite GET /api/health (200), GET /api/auth/me sans session (401), puis l'inscription et la connexion. Un HTTP 503 API_UNAVAILABLE signifie que l'API est bien routée mais que son initialisation reste indisponible ; consulter sa configuration privée et les journaux. Cela ne valide pas une base fonctionnelle.

Les documents nécessitent un stockage S3 privé avec STORAGE_BUCKET et les variables STORAGE_* décrites dans INTEGRATIONS.md. Sur Vercel, l'API refuse le stockage local éphémère si le bucket n'est pas configuré. Les comptes et le catalogue peuvent fonctionner indépendamment du stockage des documents. Paiement, vidéo et notifications nécessitent leurs propres fournisseurs.

Le serveur autonome apps/api reste disponible pour un hébergement séparé. Il n'est pas nécessaire pour le déploiement intégré. La création de la base, les migrations et l'enregistrement des secrets exigent un accès autorisé aux comptes concernés ; le dépôt seul ne les provisionne pas.

Références : [routes API Next.js](https://nextjs.org/docs/pages/building-your-application/routing/api-routes), [variables système Vercel](https://vercel.com/docs/environment-variables/system-environment-variables), [PostGIS sur Neon](https://neon.com/docs/extensions/postgis).

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
