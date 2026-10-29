# Sécurité et confidentialité

## Mesures implémentées

Mots de passe dérivés avec scrypt et sel aléatoire ; jetons opaques hachés en base ; expiration de session, révocation et suspension vérifiées à chaque requête. Le web utilise un cookie HttpOnly/SameSite Strict et un jeton CSRF mémoire. Android utilise SecureStore. Aucune session ne repose sur un rôle choisi par le client.

Validation stricte Zod, requêtes paramétrées TypeORM, CORS à origine explicite, limitation de débit, en-têtes Helmet et messages d’erreur sans trace interne. Le web utilise une CSP à nonce, sans script inline arbitraire ; les attributs de styles contrôlés des composants React sont autorisés pour la carte et les indicateurs. Les polices sont hébergées localement. Les vues privées ne sont pas mises en cache publiquement.

Descriptions, adresses, notes, détails d’audit sensibles et fichiers privés sont chiffrés en AES-256-GCM. La clé DATA_ENCRYPTION_KEY n’est pas enregistrée dans les sauvegardes de base. Les informations de compte nécessaires à l’authentification ne sont pas toutes chiffrées au niveau applicatif : chiffrer également les disques, sauvegardes et volumes hébergeurs. Les documents acceptent PDF/JPEG/PNG, contrôlent leur signature et sont limités à 5 Mo. Une analyse antivirus n’est pas intégrée.

Les accès aux documents et opérations sensibles sont audités. Les notes cliniques excluent les opérateurs et administrateurs. Les critères de disponibilité et distance n’exposent pas publiquement la position des professionnels. Les notifications externes n’incluent aucun détail de santé. L’assistant externe ne reçoit pas le texte libre du patient.

## Secrets et environnements

.env, .data, caches, clés de signature et fichiers locaux Android sont ignorés. .env.example ne contient aucune clé active. Les identifiants de démonstration ne sont créés qu’en développement explicitement activé. Le serveur refuse les faux paiements et DEMO_MODE en production, impose HTTPS et PostGIS. Les migrations de production sont une étape explicite.

Utiliser un gestionnaire de secrets en production, un compte PostgreSQL d’exécution sans privilèges DDL et un compte de migration distinct. Restreindre le réseau DB/S3 et exécuter les conteneurs sans root. Le rôle local de développement dispose volontairement de privilèges permettant migrations et bases de test ; il ne convient pas à la production.

Rotation : révoquer les sessions pour un incident de compte ; renouveler les secrets des fournisseurs et le keystore selon leurs procédures ; pour DATA_ENCRYPTION_KEY, arrêter les écritures, sauvegarder, déchiffrer puis rechiffrer toutes les colonnes et objets sous une nouvelle clé dans un environnement isolé, vérifier la restauration et reprendre. Aucun outil automatisé de rotation multi-clés n’est livré. Ne jamais changer simplement cette variable sur des données existantes.

## Conservation et droits

Les consentements sont datés et versionnés. GET /api/privacy/export renvoie les données gérées par le compte ; les autres demandes passent par le support. Le paramètre retentionReviewDays indique une échéance de revue, sans suppression automatique. Il faut arrêter une politique validée pour données cliniques, documents, factures, audit, comptes et sauvegardes ; définir les exceptions de conservation et la procédure d’effacement/anonymisation. Une purge automatique de dossiers médicaux n’est pas livrée.

Avant usage réel, faire vérifier les obligations béninoises applicables par les conseils compétents et les autorités concernées, notamment finalités, information, consentement/base juridique, données des mineurs et proches, hébergement et transferts internationaux, durée de conservation, droits, habilitations des soignants et téléconsultation. Le projet n’a reçu aucune certification juridique, médicale ou de sécurité.

## Incident

Isoler l’accès affecté, suspendre/révoquer les comptes ou clés concernés, préserver l’audit sans copier de dossiers dans des outils publics, identifier le périmètre et la période, prévenir le responsable désigné, organiser les notifications requises après avis compétent, corriger et tester, puis restaurer si nécessaire. Désigner les contacts et délais dans une procédure d’exploitation réelle. Un audit indépendant et un exercice d’incident restent à réaliser.

## Avant mise en service

Vérifier HTTPS et les domaines, MFA des administrateurs (non implémenté), restauration chiffrée hors site, analyse antivirus, limitation de charge et observabilité sans données de santé, contrats des prestataires, habilitations professionnelles, réponses aux droits et assistance réelle. Les tests automatisés documentés couvrent les règles principales ; ils ne remplacent pas un test d’intrusion ni une validation clinique.
