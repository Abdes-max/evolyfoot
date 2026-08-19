# Fondation de persistance sécurisée — Spécification

## Objectif

Poser la première brique de la Phase 2 avec une base PostgreSQL versionnée et un accès aux données testable, sans exposer prématurément les informations d'une équipe avant l'arrivée de l'authentification.

Cette tranche ne modifie pas encore le comportement visible de l'onboarding. Elle prépare un socle que l'authentification éducateur puis la synchronisation web/mobile pourront consommer sans accéder directement à Prisma depuis les interfaces.

## Périmètre retenu

La tranche ajoute :

- PostgreSQL comme base relationnelle de référence ;
- Prisma ORM et Prisma Migrate ;
- les modèles minimaux `Educator` et `Team` avec une propriété explicite de l'équipe ;
- un package `@evolyfoot/database` isolant le client Prisma et les repositories ;
- des services de création, lecture et mise à jour du profil d'équipe, toujours limités par `educatorId` ;
- une route de santé qui vérifie uniquement la disponibilité de la base ;
- une base PostgreSQL éphémère dans GitHub Actions pour les migrations et tests d'intégration ;
- les commandes et la documentation nécessaires au développement local et au futur VPS.

La tranche n'ajoute aucune route publique permettant de créer, lire ou modifier une équipe. Ces routes attendront l'authentification.

## Choix technologiques

- PostgreSQL 18.6, dernière version stable publiée ; PostgreSQL 19 reste en bêta et n'est pas retenu.
- Prisma ORM 7.8.0, version stable courante, avec `prisma`, `@prisma/client` et `@prisma/adapter-pg` alignés sur la même version.
- Pilote PostgreSQL `pg`, requis par l'adaptateur Prisma 7.
- Node.js 22.13+ et TypeScript 6.0.3 existants, compatibles avec les prérequis Prisma 7.
- ESM conservé dans le nouveau package.

Les versions exactes résolues sont verrouillées dans `pnpm-lock.yaml`. Aucun service PostgreSQL managé n'est imposé : le même schéma doit fonctionner en local, dans GitHub Actions et sur le VPS.

## Modèle de données

### Educator

- `id` : UUID généré ;
- `email` : normalisé en minuscules et unique ;
- `displayName` : nom d'affichage nettoyé ;
- `createdAt` et `updatedAt` : horodatages gérés par la base/Prisma.

### Team

- `id` : UUID généré ;
- `educatorId` : clé étrangère obligatoire vers le propriétaire ;
- `name` : nom d'équipe nettoyé ;
- `ageGroup` : enum `U10 | U11 | U12 | U13` ;
- `playerCount` : entier validé entre 6 et 30 ;
- `sessionsPerWeek` : entier validé entre 1 et 4 ;
- `trainingDays` : tableau de l'enum des jours déjà reconnu par le domaine ;
- `createdAt` et `updatedAt`.

Un éducateur possède au maximum une équipe dans ce MVP. Une contrainte unique sur `educatorId` matérialise cette règle. La suppression en cascade de l'éducateur supprime son équipe ; aucune suppression applicative n'est exposée dans cette tranche.

## Frontières et responsabilités

### `@evolyfoot/domain`

Le domaine reste indépendant de Prisma et de PostgreSQL. `TeamProfile` et `createTeamProfile()` demeurent les autorités de validation et de normalisation du profil métier.

### `@evolyfoot/database`

Le nouveau package contient :

- la configuration et le schéma Prisma ;
- la fabrique du client PostgreSQL/Prisma ;
- les mappings entre enregistrements Prisma et types du domaine ;
- `EducatorRepository` et `TeamRepository` ;
- les implémentations Prisma ;
- les erreurs applicatives stables, indépendantes des codes Prisma.

Les composants React, routes Expo et pages Next.js n'importent jamais Prisma ou le pilote `pg`.

### Services métier

Les opérations de cette tranche sont :

- créer un éducateur de test/de bootstrap par email normalisé ;
- enregistrer ou remplacer le profil d'équipe d'un éducateur ;
- relire le profil uniquement avec le même `educatorId` ;
- signaler explicitement un éducateur ou une équipe inexistants.

Toutes les lectures et écritures d'équipe incluent le propriétaire dans leur filtre. Un identifiant d'équipe seul n'est jamais suffisant.

## Connexion et cycle de vie

Prisma 7 utilise obligatoirement l'adaptateur PostgreSQL direct. La fabrique reçoit explicitement `DATABASE_URL`, crée `PrismaPg`, puis `PrismaClient`. Une instance mise en cache est permise uniquement côté serveur Next.js pour éviter les connexions multiples pendant le rechargement de développement ; les tests créent et ferment leur propre instance.

Les migrations sont générées et versionnées. Les environnements partagés exécutent `prisma migrate deploy`, jamais `migrate dev`. Le déploiement VPS devra appliquer les migrations avant de démarrer la nouvelle image applicative.

## Route de santé

`GET /api/health/database` exécute une requête minimale (`SELECT 1`) et retourne :

- `200` avec `{ "status": "ok" }` lorsque PostgreSQL répond ;
- `503` avec `{ "status": "unavailable" }` sinon.

La réponse ne révèle ni URL, ni hôte, ni version, ni message interne. L'erreur détaillée reste uniquement dans le journal serveur. La route ne crée et ne lit aucune donnée métier.

## Configuration et secrets

- `DATABASE_URL` est obligatoire au runtime serveur et pour les migrations.
- `.env.example` contient une URL locale sans secret réel.
- aucun fichier `.env`, mot de passe VPS ou secret GitHub n'est commité.
- les modules client web/mobile ne peuvent pas importer la variable ou le package database.

Le développement local documente un conteneur PostgreSQL 18.6 à port fixe. Les commandes de création et de suppression des volumes restent explicites : aucune commande de nettoyage destructif n'est exécutée automatiquement.

## Erreurs et cohérence

- L'email est nettoyé puis mis en minuscules avant écriture.
- Le profil d'équipe passe par `createTeamProfile()` avant toute écriture.
- L'upsert d'équipe cible la contrainte unique `educatorId` et reste idempotent pour une même entrée.
- Les erreurs Prisma attendues sont traduites en erreurs applicatives sans exposer les détails SQL.
- Une migration ou un test échoue immédiatement si `DATABASE_URL` est absent.
- Aucune donnée de joueur individuel n'est ajoutée au schéma de cette tranche.

## Tests et CI

### Unitaires

- normalisation de l'email ;
- mapping base ↔ domaine ;
- traduction des erreurs attendues ;
- validation déléguée au domaine avant appel du repository.

### Intégration PostgreSQL

- migrations applicables sur une base vide ;
- création d'un éducateur et unicité de l'email normalisé ;
- création puis mise à jour idempotente de l'équipe ;
- isolation entre deux éducateurs ;
- rejet d'un profil invalide sans écriture ;
- suppression en cascade vérifiée ;
- sérialisation du tableau de jours et des enums.

### Route Next.js

- réponse `200` sans fuite d'information lorsque la base répond ;
- réponse `503` stable lorsque l'accès échoue, avec dépendance injectée dans le test.

GitHub Actions démarre `postgres:18.6`, attend son état sain, applique `prisma migrate deploy`, puis exécute les tests. La CI existante conserve le frozen lockfile, les types, le lint, les tests, le build web, le bundle Android et l'E2E.

## Documentation et exploitation

La tranche met à jour :

- `docs/architecture.md` avec la nouvelle frontière database ;
- `docs/testing.md` avec les commandes de migration et tests PostgreSQL ;
- `docs/delivery.md` avec l'ordre migration → démarrage sur VPS ;
- `docs/roadmap.md` en marquant la fondation PostgreSQL/Prisma terminée, sans prétendre que les comptes ou la synchronisation le sont.

## Critères d'acceptation

1. Une base PostgreSQL 18.6 vide peut recevoir toutes les migrations versionnées.
2. Les repositories persistent un éducateur et son unique équipe sans importer Prisma dans le domaine ou les interfaces.
3. Toute opération d'équipe est limitée par `educatorId` et l'isolation multi-éducateurs est testée.
4. Un profil invalide ne déclenche aucune écriture.
5. La route de santé ne divulgue aucune information de connexion ou erreur interne.
6. Les tests PostgreSQL s'exécutent dans GitHub Actions et toute la CI reste verte au SHA final.
7. Aucun secret, donnée joueur, authentification factice ou endpoint métier public n'est ajouté.

## Étapes suivantes

1. Authentification éducateur et sessions sécurisées.
2. Routes d'équipe autorisées par la session, sans accepter un `educatorId` fourni par le client.
3. Client partagé et synchronisation web/mobile avec stratégie hors ligne explicite.

## Hors périmètre

- Mot de passe, magic link, OAuth ou gestion de session.
- API publique du profil d'équipe.
- Synchronisation mobile ou cache hors ligne.
- Persistance des joueurs, diagnostics, plans, séances ou observations.
- Sauvegarde, réplication, haute disponibilité ou monitoring PostgreSQL du VPS.
- Hébergement PostgreSQL managé.
