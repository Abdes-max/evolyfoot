# Architecture

## Décisions initiales

- Monorepo pnpm et Turborepo pour partager le métier sans coupler les interfaces.
- Next.js App Router pour l'expérience web et la future API.
- Expo Router pour livrer Android et iOS avec une base React Native unique.
- TypeScript strict partout.
- PostgreSQL et Prisma seront ajoutés avec le premier flux persistant.

## Versions de fondation

- Node.js 22.13 minimum.
- Next.js 16.2.12 et React 19.2.8 côté web.
- Expo SDK 57.0.9, React 19.2.3 et React Native 0.86.2 côté mobile.
- Les versions mobiles suivent le template officiel Expo SDK 57 afin d'éviter les combinaisons non supportées.

## Frontières

- `domain` contient le vocabulaire métier et aucune dépendance d'interface.
- `design-tokens` expose les valeurs visuelles communes ; chaque plateforme les adapte.
- Les applications orchestrent l'affichage et les interactions.
- Le futur accès aux données passera par des services explicites, sans accès direct depuis les composants.

## Évolution prévue

1. Prototype navigable avec données locales.
2. Authentification et stockage PostgreSQL.
3. Moteur de recommandations fondé sur des règles explicables.
4. Assistance IA encadrée par le plan, les observations et des garde-fous métier.
