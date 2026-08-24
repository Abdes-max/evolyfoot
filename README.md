# EvolyFoot

EvolyFoot est un assistant de progression pour les éducateurs de football de jeunes (U10 à U13). Il transforme les observations du terrain en un plan de développement vivant sur toute la saison.

## Boucle produit

**Planifier → Entraîner → Observer → Ajuster**

Le produit ne se limite pas à gérer un effectif ou à générer des séances aléatoires. Il aide l'éducateur à choisir des priorités, préparer ses séances, observer les matchs et rééquilibrer la suite du cycle.

## Structure

- `apps/web` — application web Next.js
- `apps/mobile` — application mobile Expo / React Native
- `packages/domain` — modèles et données métier partagés
- `packages/database` — schéma Prisma, migrations PostgreSQL et adaptateurs de persistance côté serveur
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

## Base de données locale

La fondation PostgreSQL est disponible pour les migrations et les tests d’intégration. L’authentification éducateur, les API d’équipe sécurisées et la synchronisation web/mobile ne sont pas encore livrées.

Crée une base locale nommée, avec son volume persistant :

```bash
docker volume create evolyfoot-postgres-data
docker run --name evolyfoot-postgres \
  --detach \
  --publish 5432:5432 \
  --env POSTGRES_USER=evolyfoot \
  --env POSTGRES_PASSWORD=evolyfoot \
  --env POSTGRES_DB=evolyfoot \
  --volume evolyfoot-postgres-data:/var/lib/postgresql/data \
  postgres:18.6
```

Dans un fichier `.env` local non commité, utilise l’exemple suivant (valeur de développement uniquement) :

```dotenv
DATABASE_URL="postgresql://evolyfoot:evolyfoot@localhost:5432/evolyfoot?schema=public"
```

Prépare ensuite le client, applique les migrations et exécute les tests d’intégration :

```bash
pnpm db:generate
pnpm db:migrate:deploy
pnpm db:test:integration
```

Pour arrêter la base locale sans supprimer ses données :

```bash
docker stop evolyfoot-postgres
```

Pour supprimer définitivement la base locale, supprime d’abord le conteneur arrêté, puis le volume. La seconde commande est destructive : elle efface les données locales.

```bash
docker rm evolyfoot-postgres
docker volume rm evolyfoot-postgres-data
```

## Vérifications

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm test
pnpm test:e2e
```
