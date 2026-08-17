# EvolyFoot

EvolyFoot est un assistant de progression pour les éducateurs de football de jeunes (U10 à U13). Il transforme les observations du terrain en un plan de développement vivant sur toute la saison.

## Boucle produit

**Planifier → Entraîner → Observer → Ajuster**

Le produit ne se limite pas à gérer un effectif ou à générer des séances aléatoires. Il aide l'éducateur à choisir des priorités, préparer ses séances, observer les matchs et rééquilibrer la suite du cycle.

## Structure

- `apps/web` — application web Next.js
- `apps/mobile` — application mobile Expo / React Native
- `packages/domain` — modèles et données métier partagés
- `packages/design-tokens` — couleurs, espacements et rayons partagés
- `packages/typescript-config` — configuration TypeScript commune
- `docs` — cadrage produit, MVP et architecture

Le suivi détaillé est tenu dans [`docs/roadmap.md`](docs/roadmap.md). La stratégie de tests et celle de livraison sont documentées dans [`docs/testing.md`](docs/testing.md) et [`docs/delivery.md`](docs/delivery.md).

## Démarrer

Prérequis : Node.js 22.13+ et pnpm 10. Le plancher Node.js est dicté par Expo SDK 57.

```bash
pnpm install
pnpm dev:web
```

Pour le mobile :

```bash
pnpm dev:mobile
```

## Vérifications

```bash
pnpm typecheck
pnpm lint
pnpm build
```
