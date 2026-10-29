# Exécution SOS DOCTEURS

Audit initial du 27 octobre 2026 : dossier vide, aucun code ni AGENTS.md à conserver. Node 24, Android Studio et SDK Android présents. PostgreSQL présent, à vérifier. Aucun identifiant marchand ou service externe fourni.

Priorités :

1. PostgreSQL/PostGIS, migrations TypeORM, sessions révocables, contrôles d'accès.
2. Parcours soins : bénéficiaire, demande, validation, affectation, suivi, facture.
3. Web français responsive avec espaces selon les rôles et administration.
4. Paiements idempotents et prestataires configurables ; Android Expo et tentative APK.
5. Tests de sécurité et d'intégration, documentation d'exploitation et limites vérifiées.

Décisions : npm workspaces (équivalent cohérent au monorepo recommandé), TypeORM comme seul ORM, dates stockées en UTC et affichées Africa/Porto-Novo, montants entiers en XOF. Pas de Redis sans besoin. Aucune donnée fictive en production. Les tarifs initiaux sont non définis et doivent être fixés par un administrateur.
