# Stratégie de tests

## Pyramide

- **Unitaires** : règles métier pures dans `packages/domain` avec Vitest.
- **Intégration** : rendu des parcours web avec Testing Library et données métier partagées.
- **Intégration PostgreSQL** : migrations Prisma et dépôts de `packages/database` contre une base PostgreSQL accessible par `DATABASE_URL`.
- **End-to-end** : parcours critiques dans un navigateur réel avec Playwright.
- **Mobile** : la couverture actuelle comprend le contrôle TypeScript, la revue d’accessibilité et la génération du bundle Android. Les tests de composants natifs restent une amélioration future lorsqu’un harnais de test React Native sera introduit.

## Commandes

```bash
pnpm test:unit
pnpm test:integration
pnpm test:e2e
```

Avant les tests qui touchent PostgreSQL, génère le client et applique les migrations :

```bash
pnpm db:generate
pnpm db:migrate:deploy
pnpm db:test:integration
```

`pnpm db:test:integration` manipule une vraie base : utilise une instance locale ou de CI dédiée, jamais une base partagée ou de production. Les instructions de création et d’arrêt non destructif de la base locale sont dans le [README](../README.md#base-de-donn%C3%A9es-locale).

La CI démarre PostgreSQL 18.6 avec une base de test dédiée, puis exécute la génération Prisma, les migrations, les types, le lint, les tests et le build. Le parcours E2E Chromium reste exécuté dans son job distinct sur chaque pull request vers `master`.

## Démonstration locale

Dans un premier terminal, démarre l’application web :

```bash
pnpm install
pnpm dev:web
```

Ouvre ensuite le parcours dans cet ordre : `/onboarding` → `/diagnostic` → `/plan` → `/session` → `/observation`. Valide la séance, choisis `Observer cette séance`, renseigne les quatre comportements puis valide l’observation.

### Scénario 1 — Garder le cap

Choisis `En progrès` pour les quatre comportements. Evoly propose `Garder le cap` : le thème et la contrainte actuels restent en place pour consolider le repère. Choisis `Appliquer cet ajustement`, vérifie le message `Ajustement appliqué à la prochaine séance`, puis choisis `Annuler` pour revenir à la proposition.

### Scénario 2 — Renforcer un comportement

Choisis `À renforcer` pour `Réagir après la perte` afin d’obtenir `0/100`, puis `En progrès` pour les trois autres comportements. Evoly propose de renforcer `Réagir après la perte` dans une situation plus lisible. Choisis `Garder mon plan`, vérifie le message `Plan actuel conservé`, puis choisis `Reconsidérer la proposition` pour revenir à la proposition.

Les rapports d’observation et les décisions d’ajustement restent uniquement locaux dans ce prototype : ils ne sont ni enregistrés dans PostgreSQL, ni synchronisés vers un compte ou un appareil.

Le parcours automatisé correspondant se lance avec :

```bash
pnpm test:e2e
```

## Convention

- `*.test.ts` : test unitaire métier.
- `*.integration.test.tsx` : test d'intégration d'interface.
- `e2e/*.spec.ts` : scénario utilisateur complet.
- Un bug corrigé doit recevoir un test qui aurait échoué avant la correction.
