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

Le constructeur de séance reste pour l’instant branché sur des données de démonstration.

## Évolution prévue

1. Prototype navigable avec données locales.
2. Authentification éducateur et routes d’équipe autorisées par la session — fait.
3. Synchronisation des données d’équipe entre les interfaces.
4. Moteur de recommandations fondé sur des règles explicables.
5. Assistance IA encadrée par le plan, les observations et des garde-fous métier.
