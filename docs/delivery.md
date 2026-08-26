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

## Déploiement VPS PostgreSQL

Le déploiement de la fondation de persistance suit cet ordre, sur une fenêtre de maintenance et avec les secrets fournis par l’environnement VPS :

1. Sauvegarder la base de données existante et vérifier que la restauration est possible.
2. Déployer l’image ou l’artefact applicatif.
3. Exécuter une seule fois `prisma migrate deploy` pour cette version (par exemple `pnpm db:migrate:deploy` dans l’artefact déployé).
4. Démarrer l’application.
5. Appeler `GET /api/health/database` depuis le réseau autorisé et vérifier la réponse saine.

PostgreSQL ne doit pas exposer de port public : seul le port de l’application est exposé, et l’application accède à la base via le réseau privé du VPS. Les mots de passe et `DATABASE_URL` de production restent dans le gestionnaire de secrets de l’environnement, jamais dans le dépôt ou les journaux.

Cette tranche ne livre ni authentification éducateur ni API d’équipe sécurisée. Les sauvegardes automatisées et la supervision de la base restent à mettre en place avant un usage de production.
