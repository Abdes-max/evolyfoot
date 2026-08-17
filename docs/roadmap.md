# Plan et avancement

Dernière mise à jour : 17 août 2026.

## Phase 0 — Fondation

- [x] Vision produit et périmètre MVP.
- [x] Monorepo pnpm / Turborepo.
- [x] Shell Next.js et tableau de bord responsive.
- [x] Shell Expo / React Native.
- [x] Domaine et design tokens partagés.
- [x] Stratégie de tests et premiers tests unitaires, intégration et E2E.
- [x] Workflow CI GitHub Actions.
- [x] Stratégie de branches, PR et livraison.
- [ ] Installation complète et génération du lockfile — réseau npm indisponible localement. La CI utilise temporairement `--no-frozen-lockfile`; elle passera à `--frozen-lockfile` dès que le lockfile sera commité.
- [ ] Première PR vers `master` — authentification GitHub locale à renouveler.
- [ ] Activer le contrôle Prettier dans la CI après le premier formatage automatisé.

### Journal de validation

- 17 août 2026 — CI #1 : bootstrap arrêté avant installation, car le cache `setup-node` exigeait déjà `pnpm-lock.yaml`. Cache retiré temporairement et export du lockfile ajouté au workflow.
- 17 août 2026 — CI #2 : GitHub n'a pas pu télécharger `pnpm/action-setup` (503 puis 429/502). L'action tierce a été remplacée par Corepack fourni avec Node.js 22.
- 17 août 2026 — CI #3 : `setup-node@v5` a détecté pnpm et tenté son auto-cache avant Corepack. L'auto-cache est explicitement désactivé jusqu'au commit du lockfile.
- 17 août 2026 — CI #4 : installation réussie et lockfile généré. Le typecheck a détecté l'option `baseUrl`, supprimée dans TypeScript 6 ; configuration corrigée.
- 17 août 2026 — CI #5 : typecheck applicatif atteint. Les extensions d'assertion `jest-dom` n'étaient pas incluses dans le programme TypeScript ; fichiers de configuration Vitest ajoutés au périmètre.
- 17 août 2026 — CI #6 : web et packages partagés validés. La référence historique `expo-router/types`, absente d'Expo Router 57, a été retirée au profit des types générés Expo déjà inclus.
- 17 août 2026 — CI #7 : typecheck entièrement vert. Le lint a détecté TypeScript 7.0.2 non encore supporté par `typescript-eslint` ; TypeScript verrouillé sur 6.0.3 et Next.js aligné avec sa configuration ESLint en 16.3.1.

## Phase 1 — Prototype métier navigable

- [ ] Onboarding équipe et catégorie.
- [ ] Diagnostic initial guidé.
- [ ] Plan de développement sur quatre semaines.
- [ ] Constructeur de séance.
- [ ] Observation rapide après séance et match.
- [ ] Ajustement explicable proposé par Evoly.

## Phase 2 — Persistance et comptes

- [ ] PostgreSQL et Prisma.
- [ ] Authentification éducateur.
- [ ] API et services métier.
- [ ] Données d'équipe synchronisées web/mobile.

## Phase 3 — Bêta et distribution

- [ ] Préproduction VPS.
- [ ] EAS Build preview.
- [ ] TestFlight et piste interne Google Play.
- [ ] Mesure des indicateurs MVP.
- [ ] Déploiements de production depuis `master` uniquement.
