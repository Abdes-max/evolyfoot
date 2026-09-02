# Architecture

## Décisions initiales

- Monorepo pnpm et Turborepo pour partager le métier sans coupler les interfaces.
- Next.js App Router pour l'expérience web et la future API.
- Expo Router pour livrer Android et iOS avec une base React Native unique.
- TypeScript strict partout.
- PostgreSQL et Prisma 7 pour la fondation de persistance.

## Versions de fondation

- Node.js 22.13 minimum.
- Next.js 16.3.1 et React 19.2.8 côté web.
- Expo SDK 57.0.9, React 19.2.3 et React Native 0.86.2 côté mobile.
- Les versions mobiles suivent le template officiel Expo SDK 57 afin d'éviter les combinaisons non supportées.
- TypeScript 6.0.3 est verrouillé tant que `typescript-eslint` ne supporte pas TypeScript 7.
- ESLint 9.39.5 est verrouillé tant que le plugin React de la configuration Next.js ne supporte pas ESLint 10.

## Frontières

- `domain` contient le vocabulaire métier et aucune dépendance d'interface.
- `database` contient le schéma Prisma, les migrations et les adaptateurs qui implémentent les ports de persistance du domaine. Il est réservé aux exécutions serveur et ne doit pas être importé par les composants web client ou l’application mobile.
- `design-tokens` expose les valeurs visuelles communes ; chaque plateforme les adapte.
- Les applications orchestrent l'affichage et les interactions.
- L’accès aux données passe par des services explicites et des dépôts, sans accès direct depuis les composants.

## Accès PostgreSQL

Le client Prisma est créé à partir de `DATABASE_URL` au point d’exécution serveur. Prisma 7 utilise l’adaptateur `@prisma/adapter-pg` (`PrismaPg`) fourni au `PrismaClient` : cette décision maintient le pilote PostgreSQL explicite et évite de transporter une configuration de base de données vers le navigateur. La vérification de santé déconnecte sa poignée de connexion dans un `finally` ; les routes et services serveur sont les seules frontières autorisées vers la base.

## Authentification

`AuthService` (`packages/database`) orchestre l’inscription, la connexion, la déconnexion et la résolution d’une session, au-dessus des mêmes ports `EducatorRepository`/`SessionRepository` que le reste de la persistance. Les mots de passe sont hachés avec `scrypt` (module `node:crypto`, aucune dépendance externe) et jamais stockés ni renvoyés en clair. Une session est un jeton aléatoire opaque (32 octets, `base64url`) : seul son hachage SHA-256 est persisté dans la table `sessions`, avec une date d’expiration ; le jeton en clair ne vit que dans un cookie `HttpOnly`, `SameSite=Lax`, `Secure` en production, posé par les routes `POST /api/auth/{register,login,logout}` et lu par `GET /api/auth/session`. Les erreurs de validation (`ValidationError`), d’identifiants invalides (`InvalidCredentialsError`) et de conflit d’e-mail (`DuplicateEducatorEmailError`) sont traduites en réponses HTTP explicites (400/401/409) sans jamais exposer de détail interne, sur le même principe que la vérification de santé de la base.

`GET`/`PUT /api/team` (`apps/web/src/server/team.ts`) résolvent l’éducateur depuis le cookie de session (via `AuthService.getEducatorForSession`) avant tout accès à `TeamProfileService` : la route ignore tout `educatorId` présent dans le corps de la requête et n’en accepte aucun en paramètre. Le tableau de bord (`SidebarIdentity`) et le formulaire d’onboarding sont des composants client qui interrogent `/api/auth/session` puis `/api/team` : un éducateur connecté voit et modifie son équipe réelle, tandis qu’un visiteur anonyme voit le contenu de démonstration accompagné d’une invitation à se connecter. Ce choix — un dégradé plutôt qu’un mur de connexion strict imposé par un middleware — évite de bloquer l’exploration du prototype tant que le reste du tableau de bord (priorités, séance suivante, ajustements) n’a pas encore de persistance propre.

`GET`/`PUT /api/diagnostic` suivent exactement le même schéma que `/api/team` (`apps/web/src/server/diagnostic.ts`, `DiagnosticService`, un diagnostic par éducateur). Le plan de développement n’est **pas** persisté séparément : `buildDevelopmentPlan` est une fonction pure du diagnostic, donc `/plan` (web : `plan-view.tsx` ; mobile : `app/plan.tsx`) le recalcule à chaque affichage à partir du diagnostic enregistré, lu depuis `/api/diagnostic` (web) ou le contexte d’authentification déjà chargé au login (mobile). Ceci corrige un bug préexistant où `/plan` ignorait complètement les réponses saisies sur `/diagnostic` et recalculait toujours le même cycle à partir de scores codés en dur.

`POST /api/sessions` et `POST /api/observations` suivent un schéma distinct de `/api/team` et `/api/diagnostic` : pas de `GET`, pas de mise à jour, chaque validation crée une nouvelle ligne d’historique (`TrainingSessionService`/`ObservationService`, tables `training_sessions`/`observations`, indexées par `educator_id` mais sans contrainte d’unicité) plutôt qu’un enregistrement unique par éducateur. Aucune UI de consultation d’historique n’existe encore, donc aucune route de lecture n’a été ajoutée. Les deux services rejouent la validation métier côté serveur avant toute écriture — jamais côté client seul : `TrainingSessionService.save` résout chaque `activityId` reçu depuis le catalogue du domaine (`findTrainingActivity`) pour reconstruire la séance complète et vérifier sa durée (`canValidateSession`, 60-90 min) et son thème/catégorie d’âge, sans jamais faire confiance à des données dérivées envoyées par le client ; `ObservationService.save` recalcule intégralement le résumé (`completeObservation`) plutôt que d’accepter celui déjà calculé côté client. `/session` (web : `session-view.tsx` ; mobile : `app/session.tsx`) et `/observation` suivent le même dégradé anonyme/connecté que `/plan`, corrigeant le même bug préexistant (diagnostic et effectif codés en dur, déconnectés de l’équipe et du diagnostic réels).

`Team.gameFormat` (foot à 4 jusqu’au foot à 11) est un entier borné en base, pas un enum Postgres comme `AgeGroup`/`DevelopmentTheme` — ce n’est pas une énumération de valeurs nommées mais une plage validée côté domaine (`gameFormats` dans `@evolyfoot/domain`), rejouée à chaque écriture par `TeamProfileService`/`TrainingSessionService` avant que la valeur n’atteigne Prisma.

`Player` (table `players`, un CRUD complet : `PlayerRepository.listByEducator/create/rename/remove`) comble la limite notée plus haut : c’est le premier modèle nominatif de l’application. Rattaché à `educatorId` plutôt qu’à `Team` — un éducateur peut renseigner ses joueurs avant même d’avoir terminé l’onboarding de son équipe, et la liste survit à une éventuelle recréation de celle-ci. Contrairement au patron append-only de `TrainingSessionRecord`/`ObservationRecord`, `rename`/`remove` vérifient l’appartenance à l’éducateur dans la même requête que l’écriture (`updateMany`/`deleteMany` filtrés sur `{ id, educatorId }`, jamais un `findUnique` puis un `update` séparés qui laisserait une fenêtre entre vérification et écriture). `/equipe` (web : `roster-view.tsx` ; mobile : `app/equipe.tsx`) expose ce CRUD ; `/observation` (web et mobile) lit cet effectif réel via `GET /api/roster` pour peupler la liste des joueurs à retenir, avec repli sur des joueurs de démonstration tant que l’éducateur n’en a ajouté aucun. Une observation déjà enregistrée reste volontairement une photo figée (JSON, sans clé étrangère vers `Player`) : renommer ou retirer un joueur plus tard ne modifie jamais une observation passée.

## Authentification et données mobiles

L’application mobile n’a pas de pot de cookies : elle porte le jeton de session dans un en-tête `Authorization: Bearer`, et signale sa plateforme via l’en-tête `X-Client-Platform: mobile` pour que `/api/auth/register` et `/api/auth/login` lui renvoient ce jeton en clair dans le corps de la réponse — uniquement pour un client identifié comme mobile, jamais pour le web (qui continue de s’appuyer exclusivement sur le cookie `HttpOnly`, afin qu’un XSS ne puisse pas lire le jeton dans une réponse `fetch`). `readSessionToken` (`apps/web/src/server/auth.ts`) résout la session en vérifiant d’abord l’en-tête `Authorization`, puis le cookie : les mêmes routes `/api/auth/*` et `/api/team` servent donc indifféremment le web et le mobile.

Côté mobile (`apps/mobile/lib/auth-context.tsx`), la session — éducateur, équipe, jeton — vit uniquement en mémoire dans un contexte React tant que l’application tourne : elle se perd à son redémarrage complet. Ce choix évite d’introduire une dépendance de stockage persistant (`expo-secure-store` ou équivalent) dans un environnement où l’installation de nouvelles dépendances npm n’était pas fiable au moment de cette implémentation ; un stockage persistant réel reste une amélioration future explicite.

Les écrans `/connexion`, `/inscription` et l’onboarding mobile (nom d’équipe, catégorie, effectif, jours d’entraînement) reproduisent les mêmes champs et la même validation métier (`@evolyfoot/domain`) que leurs équivalents web, et appellent les mêmes routes `/api/team` : les données d’équipe créées sur une plateforme sont donc immédiatement visibles sur l’autre, une fois l’éducateur connecté des deux côtés. Vérifié de bout en bout sur émulateur Android contre le serveur web et PostgreSQL réels.

## Évolution prévue

1. Prototype navigable avec données locales.
2. Authentification éducateur, routes d’équipe autorisées par la session et données d’équipe synchronisées web/mobile — fait.
3. Stockage de session persistant côté mobile (au-delà de la mémoire process).
4. Moteur de recommandations fondé sur des règles explicables.
5. Assistance IA encadrée par le plan, les observations et des garde-fous métier.
