# Livraison et environnements

## Gouvernance Git

- `master` est la branche de production et doit être protégée.
- Toute modification passe par une branche `agent/*` ou `feature/*` et une pull request.
- La CI doit réussir avant le merge.
- Le merge recommandé est **squash and merge**.
- Aucun déploiement de production ne part d'une branche de travail.

## Cibles

| Cible | Source | Outil prévu |
| --- | --- | --- |
| Web / API | `master` | image Docker vers VPS |
| iOS | tag de version issu de `master` | EAS Build puis TestFlight / App Store |
| Android | tag de version issu de `master` | EAS Build puis piste interne / Play Store |

## Stratégie progressive

1. CI de validation sur toutes les PR.
2. Environnement de préproduction sur le VPS.
3. Déploiement de production avec approbation GitHub Environment.
4. Profils EAS `preview` et `production` signés.
5. Soumission aux stores après validation fonctionnelle et conformité.

Les workflows de déploiement seront activés seulement lorsque les accès VPS, Apple Developer, Google Play Console, les domaines et les secrets GitHub seront disponibles. Aucun secret ne doit être commité.
