# Stratégie de tests

## Pyramide

- **Unitaires** : règles métier pures dans `packages/domain` avec Vitest.
- **Intégration** : rendu des parcours web avec Testing Library et données métier partagées.
- **End-to-end** : parcours critiques dans un navigateur réel avec Playwright.
- **Mobile** : le contrôle TypeScript est actif dès le socle ; les tests de composants React Native seront ajoutés avec le premier flux interactif.

## Commandes

```bash
pnpm test:unit
pnpm test:integration
pnpm test:e2e
```

La CI exécute formatage, types, lint, tests, build et le parcours E2E Chromium sur chaque pull request vers `master`.

## Démonstration locale

Dans un premier terminal, démarre l’application web :

```bash
pnpm install
pnpm dev:web
```

Ouvre ensuite le parcours dans cet ordre : `/onboarding` → `/diagnostic` → `/plan` → `/session` → `/observation`. Valide la séance, choisis `Observer cette séance`, renseigne les quatre comportements puis valide l’observation. Le rapport reste local au prototype ; il n’est pas encore enregistré dans PostgreSQL.

Le parcours automatisé correspondant se lance avec :

```bash
pnpm test:e2e
```

## Convention

- `*.test.ts` : test unitaire métier.
- `*.integration.test.tsx` : test d'intégration d'interface.
- `e2e/*.spec.ts` : scénario utilisateur complet.
- Un bug corrigé doit recevoir un test qui aurait échoué avant la correction.
