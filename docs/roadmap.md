# Plan et avancement

Dernière mise à jour : 27 août 2026 (données d'équipe synchronisées web/mobile).

## Phase 0 — Fondation

- [x] Vision produit et périmètre MVP.
- [x] Monorepo pnpm / Turborepo.
- [x] Shell Next.js et tableau de bord responsive.
- [x] Shell Expo / React Native.
- [x] Domaine et design tokens partagés.
- [x] Stratégie de tests et premiers tests unitaires, intégration et E2E.
- [x] Workflow CI GitHub Actions.
- [x] Stratégie de branches, PR et livraison.
- [x] Installation complète et génération du lockfile validées dans GitHub Actions ; CI passée à `--frozen-lockfile`.
- [x] Première PR vers `master` fusionnée après validation complète de la CI.
- [ ] Activer le contrôle Prettier dans la CI après le premier formatage automatisé.

### Journal de validation

- 17 août 2026 — CI #1 : bootstrap arrêté avant installation, car le cache `setup-node` exigeait déjà `pnpm-lock.yaml`. Cache retiré temporairement et export du lockfile ajouté au workflow.
- 17 août 2026 — CI #2 : GitHub n'a pas pu télécharger `pnpm/action-setup` (503 puis 429/502). L'action tierce a été remplacée par Corepack fourni avec Node.js 22.
- 17 août 2026 — CI #3 : `setup-node@v5` a détecté pnpm et tenté son auto-cache avant Corepack. L'auto-cache est explicitement désactivé jusqu'au commit du lockfile.
- 17 août 2026 — CI #4 : installation réussie et lockfile généré. Le typecheck a détecté l'option `baseUrl`, supprimée dans TypeScript 6 ; configuration corrigée.
- 17 août 2026 — CI #5 : typecheck applicatif atteint. Les extensions d'assertion `jest-dom` n'étaient pas incluses dans le programme TypeScript ; fichiers de configuration Vitest ajoutés au périmètre.
- 17 août 2026 — CI #6 : web et packages partagés validés. La référence historique `expo-router/types`, absente d'Expo Router 57, a été retirée au profit des types générés Expo déjà inclus.
- 17 août 2026 — CI #7 : typecheck entièrement vert. Le lint a détecté TypeScript 7.0.2 non encore supporté par `typescript-eslint` ; TypeScript verrouillé sur 6.0.3 et Next.js aligné avec sa configuration ESLint en 16.3.1.
- 17 août 2026 — CI #8 : TypeScript validé. Le plugin React de Next.js ne supporte pas encore l'API ESLint 10 ; ESLint verrouillé sur la dernière version 9.39.5 compatible.
- 17 août 2026 — CI #9 : typecheck et lint verts. Vitest nécessitait le transform JSX React pour charger le test d'intégration ; plugin React officiel Vite 6.0.4 ajouté.
- 17 août 2026 — CI #10 : typecheck, lint, tests unitaires/intégration, build et E2E Chromium entièrement verts. Lockfile de cette exécution intégré à la branche et installation CI rendue stricte.

## Phase 1 — Prototype métier navigable

- [x] Onboarding équipe et catégorie — modèle partagé, validation métier, parcours web responsive et tests automatisés.
- [x] Diagnostic initial guidé — quatre comportements observables, échelle simple et deux priorités explicables.
- [x] Plan de développement sur quatre semaines — progression découvrir, stabiliser, mettre sous pression et évaluer.
- [x] Constructeur de séance — activités spécifiques aux thèmes, informations terrain, édition sûre et parcours plan → séance couverts par les tests unitaires, d’intégration et E2E ; bundle Android Expo vérifié par la CI.
- [x] Observation rapide après séance et match.
- [x] Ajustement explicable proposé par Evoly.
- [x] Audit design (suppression des tics « vibe-codés », contrastes) puis refonte complète en thème sombre à accent bleu, avec correction des impasses de navigation (retour et sortie de parcours manquants) — retour direct de l'éducateur après test de l'application.
- [x] Bibliothèque d'exercices (`/bibliotheque`) avec schémas tactiques visuels générés à partir du catalogue d'activités (zones, joueurs, flèches), détail par exercice (but du jeu, règles, points de coaching), inspirée de Nextrainers.

## Phase 2 — Persistance et comptes

- [x] Fondation PostgreSQL et Prisma.
- [x] Authentification éducateur — inscription et connexion par e-mail et mot de passe, sessions révocables stockées côté serveur (`Session`), mots de passe hachés avec `scrypt`, routes `/api/auth/{register,login,logout,session}` et pages `/inscription` et `/connexion`.
- [x] Routes d'équipe autorisées par la session — `GET`/`PUT /api/team` résolvent l'éducateur depuis le cookie de session ; aucun `educatorId` fourni par le client n'est jamais utilisé. Le tableau de bord (bloc équipe/éducateur) et l'onboarding lisent et écrivent ces données réelles pour un éducateur connecté ; un visiteur anonyme continue de voir le contenu de démonstration et une invitation à se connecter plutôt qu'un mur de connexion imposé.
- [x] Données d'équipe synchronisées web/mobile — l'application mobile a désormais son propre inscription/connexion (`/inscription`, `/connexion`), un onboarding complet (nom, catégorie, effectif, jours d'entraînement) et un tableau de bord affichant l'éducateur et l'équipe réels, via les mêmes routes `/api/auth/*` et `/api/team` que le web. Mobile n'ayant pas de pot de cookies, les mêmes routes acceptent aussi un jeton porteur (`Authorization: Bearer`) renvoyé dans le corps de la réponse uniquement pour un client identifié comme mobile. Vérifié de bout en bout sur émulateur Android contre le serveur web et PostgreSQL réels (inscription → équipe → déconnexion/reconnexion → tableau de bord synchronisé). Limite connue : la session mobile vit uniquement en mémoire (pas de stockage persistant) et se perd au redémarrage complet de l'app — voir docs/architecture.md.

## Phase 3 — Bêta et distribution

- [ ] Préproduction VPS.
- [ ] EAS Build preview.
- [ ] TestFlight et piste interne Google Play.
- [ ] Mesure des indicateurs MVP.
- [ ] Déploiements de production depuis `master` uniquement.
