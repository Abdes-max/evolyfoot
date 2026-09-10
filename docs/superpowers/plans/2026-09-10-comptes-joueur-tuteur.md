# Comptes joueur / tuteur — Plan d'implémentation

> **Pour les exécutants :** implémenter tâche par tâche. Chaque tâche = un livrable testable indépendamment, se termine par un commit. Étapes en `- [ ]` pour le suivi.

**Objectif :** un éducateur peut inviter le tuteur d'un joueur de son effectif ; ce tuteur crée un compte séparé qui ne voit que le suivi de ce joueur (fiche, présences, calendrier de l'équipe, convocations) — jamais le contenu éducateur.

**Architecture :** un seul modèle de compte (`Educator`, renommé conceptuellement « compte ») avec un champ `role` (`coach` | `player`). Un compte `player` porte un `linkedPlayerId` vers un `Player` de l'effectif. `getEducatorForSession` ne résout que les comptes `coach` — les 123 routes API éducateur rejettent donc automatiquement un jeton joueur (401). Nouvelle route famille `/api/joueur/*` + `getPlayerForSession`. Cloisonnement UI dans `auth-gate.tsx` (redirection selon le rôle) ; cloisonnement serveur par résolution de rôle dans chaque route.

**Stack :** Next.js 16 App Router, Prisma + PostgreSQL, pnpm workspaces. Tests : vitest (unit + intégration Postgres réel), Playwright E2E.

**Décisions utilisateur (2026-09-10) :**
- Rattachement : **le coach invite** (lien + jeton, un par joueur).
- Vue joueur : sa fiche (radar + présences), calendrier de l'équipe, convocations aux matchs, **rien du contenu coach**.
- Périmètre : **tout le parcours d'un coup**.

## Contraintes globales

- PRs vers `master`, gouvernance complète (typecheck / lint / test Postgres réel / build web+mobile / E2E chromium + mobile-safari) avant push ; PR verte ⇒ fusion immédiate.
- Réponses et copie produit en français.
- Ne jamais faire confiance à un `id` fourni par le client — toujours résoudre le compte via la session.
- `next-env.d.ts` régénéré : `git checkout --` avant commit.
- Messages de commit terminés par les lignes `Co-Authored-By` / `Claude-Session` de la session courante.

---

## Structure des fichiers

### packages/database
- `prisma/schema.prisma` — `Educator.role`, `Educator.linkedPlayerId` + relation, `Educator.linkedPlayerAccounts` inverse sur `Player`, nouveau `PlayerInvite`.
- `prisma/migrations/<ts>_add_player_accounts_and_invites/migration.sql`
- `src/repositories.ts` — `EducatorRecord.role`, `PlayerAccountRecord`, `PlayerInviteRecord`, interfaces `PlayerAccountRepository`, `PlayerInviteRepository` ; `EducatorRepository.createWithRole`.
- `src/mappers.ts` — `toPlayerAccountRecord`, `toPlayerInviteRecord`.
- `src/prisma-repositories.ts` — impl.
- `src/auth-service.ts` — `getEducatorForSession` filtre `role="coach"` ; nouveau `getPlayerAccountForSession` ; `registerPlayer(inviteToken, {email,password,displayName})`.
- `src/player-invite-service.ts` (nouveau) — `create(educatorId, playerId)`, `peek(token)` (infos publiques sans consommer), `consume(token, credentials)`.
- `src/player-dashboard-service.ts` (nouveau) — `get(playerAccountId)` agrège fiche + présences + calendrier + convocations.
- `src/index.ts` — exports.

### apps/web
- `src/server/auth.ts` — `resolvePlayerAccount`, `PublicPlayerAccount`, la réponse `/api/auth/session` gagne `role`.
- `src/server/player-invite.ts` (nouveau) — handlers create / peek / consume.
- `src/server/player-dashboard.ts` (nouveau) — handler get.
- `src/app/api/invites/route.ts` (POST, coach) ; `src/app/api/invites/[token]/route.ts` (GET peek — public).
- `src/app/api/auth/register-player/route.ts` (POST — public, consomme l'invitation).
- `src/app/api/joueur/route.ts` (GET — compte joueur).
- `src/app/rejoindre/[token]/page.tsx` + `join-view.tsx` — page publique d'acceptation d'invitation.
- `src/app/(player)/joueur/page.tsx` + `player-dashboard-view.tsx` + `player.css` — tableau de bord joueur.
- `src/app/(player)/layout.tsx` — coquille joueur (pas de `SidebarNav` éducateur, en-tête léger).
- `src/app/equipe/[id]/player-detail-view.tsx` — bouton « Inviter le tuteur » + affichage du lien généré.
- `src/app/auth-gate.tsx` — redirection selon le rôle (`coach` hors `/joueur` → ok ; `player` sur route coach → `/joueur` ; `player` non lié → `/connexion`).
- `src/app/connexion/login-form.tsx` — après connexion, redirige selon le rôle (`/app` ou `/joueur`).
- `src/marketing-routes.ts` — ajouter `/rejoindre` au préfixe public.
- `src/proxy.ts` — `/rejoindre/*` public.
- `e2e/dashboard.spec.ts` — parcours invitation → compte joueur → tableau de bord ; cloisonnement.

---

## Tâches

### Tâche 1 — Modèle : rôle de compte + invitations

**Fichiers :** `schema.prisma`, migration, `repositories.ts`, `mappers.ts`, `prisma-repositories.ts`, tests d'intégration.

- [ ] `Educator` : `role String @default("coach")`, `linkedPlayerId String? @unique @db.Uuid @map("linked_player_id")`, `linkedPlayer Player? @relation("PlayerFollowers", fields:[linkedPlayerId], references:[id], onDelete: Cascade)`.
- [ ] `Player` : `followers Educator[] @relation("PlayerFollowers")` (0..1 en pratique via l'unique).
- [ ] Nouveau `PlayerInvite { id, educatorId (FK Educator, cascade), playerId (FK Player, cascade), tokenHash String @unique @map("token_hash"), expiresAt, consumedAt DateTime?, createdAt, @@index([educatorId]), @@map("player_invites") }`.
- [ ] Migration SQL manuelle : `ALTER TABLE educators ADD COLUMN role TEXT NOT NULL DEFAULT 'coach'`, `ADD COLUMN linked_player_id UUID`, contrainte unique + FK cascade ; `CREATE TABLE player_invites (...)`.
- [ ] `prisma migrate deploy` local + `prisma generate`.
- [ ] `repositories.ts` : `EducatorRecord.role: "coach" | "player"`, `EducatorRecord.linkedPlayerId: string | null`. `PlayerInviteRecord`. `PlayerInviteRepository { create, findByTokenHash, markConsumed }`.
- [ ] `mappers.ts` : `toEducatorRecord` inclut `role`, `linkedPlayerId`. `toPlayerInviteRecord`.
- [ ] `prisma-repositories.ts` : `PrismaPlayerInviteRepository`. `PrismaEducatorRepository.create` accepte un `role` + `linkedPlayerId` optionnels.
- [ ] Test d'intégration `player-invite.integration.test.ts` : création, expiration, consommation unique.
- [ ] Commit.

### Tâche 2 — Auth : cloisonnement des sessions par rôle

**Fichiers :** `auth-service.ts`, `auth-service.test.ts`, tests d'intégration auth.

- [ ] `AuthService.getEducatorForSession` : ne renvoie l'`EducatorRecord` que si `role === "coach"`. Test : un jeton de session pointant vers un compte `role="player"` renvoie `null`.
- [ ] Nouveau `AuthService.getPlayerAccountForSession(token): Promise<EducatorRecord | null>` — l'inverse (`role === "player"`).
- [ ] Nouveau `AuthService.registerPlayerFromInvite(inviteToken, { email, password, displayName })` : vérifie l'invitation (non consommée, non expirée) via `PlayerInviteRepository`, crée un `Educator` `role="player"` `linkedPlayerId=invite.playerId`, marque l'invitation consommée, ouvre une session. Réutilise `hashPassword`/`validatePassword`.
- [ ] Tests unitaires (faux repos) : invitation inconnue → erreur ; invitation expirée → erreur ; invitation déjà consommée → erreur ; nominal → session + compte lié.
- [ ] Commit.

### Tâche 3 — Service invitation + service tableau de bord joueur

**Fichiers :** `player-invite-service.ts`, `player-dashboard-service.ts`, `index.ts`, tests d'intégration.

- [ ] `PlayerInviteService.create(educatorId, playerId)` : vérifie que le joueur appartient à l'éducateur (`PlayerRepository.findById`), refuse si le joueur a déjà un `follower` (compte lié) ou une invitation active, génère un jeton (`generateSessionToken` réutilisé), stocke le hash, renvoie `{ token, expiresAt }` (le jeton en clair une seule fois).
- [ ] `PlayerInviteService.peek(token)` : renvoie `{ playerName, teamName, coachName }` sans consommer, ou `null` si invalide/expiré/consommé.
- [ ] `PlayerDashboardService.get(playerAccountId)` : lit le compte (`role="player"`), son `linkedPlayer`, l'éducateur propriétaire du joueur, puis agrège :
  - `player` : `{ id, name, photo }`.
  - `evaluations` : `PlayerEvaluationRepository.listByPlayer(playerId, ownerEducatorId)`.
  - `attendance` : parcourt `TrainingSessionRepository.listByEducator` + `MatchRepository.listByEducator` de l'éducateur propriétaire, filtre les entrées `attendance` sur `playerId`, `summarizeAttendance`.
  - `team` : `TeamRepository.findForEducator(ownerEducatorId)` → `{ name, ageGroup, trainingDays }`.
  - `upcomingMatches` : matchs `status="scheduled"` de l'éducateur propriétaire → `{ id, opponent, dateLabel, venue }`.
  - `convocations` : parmi ces matchs, ceux dont `lineup` contient `playerId` → + `{ slotRole }` si dispo.
- [ ] Tests d'intégration : un compte joueur ne voit que les données de son joueur ; un autre éducateur/joueur ne fuit pas.
- [ ] `index.ts` : exporter `PlayerInviteService`, `PlayerDashboardService`, `PrismaPlayerInviteRepository`, types.
- [ ] Commit.

### Tâche 4 — Routes API

**Fichiers :** `apps/web/src/server/{auth,player-invite,player-dashboard}.ts`, routes `api/*`, tests handlers.

- [ ] `server/auth.ts` : `resolvePlayerAccount(request)` (miroir de `resolveEducator` avec `getPlayerAccountForSession`) ; `PublicPlayerAccount { id, email, displayName, linkedPlayerId }`. `createSessionHandler` (route `/api/auth/session`) renvoie désormais `{ educator, role }` où `role` vient du compte quel qu'il soit (nouvelle méthode `AuthService.getAccountRoleForSession`).
- [ ] `server/player-invite.ts` : `createCreateInviteHandler(resolveEducator, gateway)` (POST body `{ playerId }` → `{ url, expiresAt }`) ; `createPeekInviteHandler(gateway)` (public, GET → `{ playerName, teamName, coachName }` ou 404).
- [ ] `server/player-dashboard.ts` : `createGetPlayerDashboardHandler(resolvePlayerAccount, gateway)`.
- [ ] `api/invites/route.ts` (POST, éducateur), `api/invites/[token]/route.ts` (GET, public), `api/auth/register-player/route.ts` (POST, public → pose le cookie de session comme `register`), `api/joueur/route.ts` (GET, compte joueur).
- [ ] Tests handlers : auth requise, cloisonnement (jeton joueur sur route éducateur = 401 et vice-versa), invitation invalide = 404, `id`/`educatorId` du corps ignorés.
- [ ] Commit.

### Tâche 5 — Page publique « Rejoindre » + inscription joueur

**Fichiers :** `app/rejoindre/[token]/{page.tsx,join-view.tsx}`, `marketing-routes.ts`, `proxy.ts`, e2e.

- [ ] `marketing-routes.ts` : la fonction `isMarketingPath` accepte aussi `pathname.startsWith("/rejoindre/")`. `proxy.ts` : idem (déjà via `isMarketingPath`).
- [ ] `rejoindre/[token]/page.tsx` (server) : `peek` le jeton → si invalide, message « invitation expirée » ; sinon rend `join-view` avec `{ playerName, teamName, coachName }`.
- [ ] `join-view.tsx` (client) : « Tu es invité à suivre **{playerName}** dans **{teamName}** » + formulaire (nom, e-mail, mot de passe) → `POST /api/auth/register-player` → succès : `window.location.href = "/joueur"`.
- [ ] E2E : ouverture d'un lien d'invitation mocké → création de compte → arrivée sur `/joueur`.
- [ ] Commit.

### Tâche 6 — Tableau de bord joueur + coquille

**Fichiers :** `app/(player)/{layout.tsx,joueur/page.tsx,joueur/player-dashboard-view.tsx}`, `app/player.css`, `layout.tsx` (import css).

- [ ] `(player)/layout.tsx` : `<div className="player-shell">` + en-tête léger (logo → `/joueur`, bouton « Se déconnecter »). Pas de `SidebarNav`.
- [ ] `player-dashboard-view.tsx` (client) : `fetch("/api/auth/session")` → si `role!=="player"` renvoyer vers `/app` ou `/connexion` ; sinon `fetch("/api/joueur")` et afficher :
  - En-tête : photo + nom du joueur, nom de l'équipe.
  - Bloc « Ma progression » : `RadarChart` de la dernière évaluation + moyenne, lien vers l'historique (liste datée, lecture seule).
  - Bloc « Ma présence » : `DonutChart` séances + matchs.
  - Bloc « Cette semaine » : jours d'entraînement + prochains matchs.
  - Bloc « Mes convocations » : matchs où le joueur est convoqué (date, lieu, adversaire).
- [ ] `player.css` : thème cohérent avec l'app (sombre), `padding-left:0` (pas de sidebar), responsive.
- [ ] E2E : compte joueur → `/joueur` affiche la fiche, le radar, les convocations ; un accès à `/plan` redirige vers `/joueur`.
- [ ] Commit.

### Tâche 7 — Cloisonnement UI + connexion selon le rôle + bouton d'invitation

**Fichiers :** `auth-gate.tsx`, `connexion/login-form.tsx`, `equipe/[id]/player-detail-view.tsx`, tests d'intégration.

- [ ] `auth-gate.tsx` : après `fetch("/api/auth/session")`, lire `role`. Sur une route éducateur avec `role==="player"` → `router.replace("/joueur")`. Sur `/joueur*` avec `role==="coach"` → `router.replace("/app")`. `role` absent (non connecté) → comportement actuel (`/connexion`).
- [ ] `login-form.tsx` : après connexion réussie, `fetch("/api/auth/session")` pour lire `role` puis `router.replace(role === "player" ? "/joueur" : "/app")`.
- [ ] `player-detail-view.tsx` : nouveau bloc « Accès tuteur » — si le joueur a déjà un compte lié, l'indiquer ; sinon bouton « Générer un lien d'invitation » → `POST /api/invites {playerId}` → affiche le lien (copiable) + date d'expiration.
- [ ] Tests d'intégration : `auth-gate` redirige un compte joueur hors des routes éducateur ; `login-form` route selon le rôle.
- [ ] Mettre à jour `docs/roadmap.md`.
- [ ] Commit + PR.

---

## Auto-revue

**Couverture du spec :**
- Rattachement par invitation du coach → Tâches 3, 4, 5, 7. ✓
- Fiche (radar + présences) visible côté joueur → Tâche 6 (via Tâche 3). ✓
- Calendrier de l'équipe → Tâche 6. ✓
- Convocations aux matchs → Tâche 3 (`convocations`) + Tâche 6. ✓
- Rien du contenu coach → Tâches 2 (session), 4 (routes 401), 7 (auth-gate). ✓
- « Tout d'un coup » → les 7 tâches dans une seule PR. ✓

**Points de vigilance :**
- Le compte joueur reste un `Educator` en base (`role="player"`) — colonne `sessions.educator_id` sémantiquement datée mais fonctionnelle ; commenter.
- `email @unique` sur `educators` : un même e-mail ne peut pas être à la fois coach et joueur. Acceptable pour le MVP ; documenter dans le message de PR.
- `PlayerDashboardService` lit les données via l'éducateur **propriétaire** du joueur (`Player.educatorId`), jamais via le compte joueur lui-même.
- Le compte joueur n'a ni `team`, ni `diagnostic`, ni `players` — les routes `/api/team`, `/api/diagnostic`, etc. renvoient déjà 401 pour lui (Tâche 2).
