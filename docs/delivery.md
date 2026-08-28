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

**État actuel : le terrain côté code est prêt (`Dockerfile`, `docker-compose.yml`, `.github/workflows/cd.yml`, `apps/mobile/eas.json`), mais rien n'est encore déployé.** Le workflow CD est en déclenchement manuel (`workflow_dispatch`) tant que les comptes et secrets ci-dessous ne sont pas configurés — il ne se lance jamais tout seul sur un `push`.

## Déploiement web (VPS)

### Image Docker

`Dockerfile` (racine du monorepo) produit deux cibles à partir d'un même build :

- **`web`** — serveur Next.js autonome (`output: "standalone"`), image finale minimale (~230 Mo), utilisateur non-root, `HEALTHCHECK` intégré sur `/api/health/database`.
- **`migrator`** — exécute `prisma migrate deploy` une fois puis quitte ; réutilise l'étape d'installation complète (CLI Prisma + fichiers de migration), contrairement à `web` qui ne les contient pas.

Le client Prisma est généré **à l'intérieur** du conteneur Linux (pas copié depuis la machine de développement), pour obtenir le bon binaire de moteur de requête (musl/Alpine) automatiquement. Le `Dockerfile` contient aussi un contournement documenté d'un trou connu du traçage de sortie autonome de Next.js sous pnpm (dossier `@swc/helpers` imbriqué vidé de son contenu réel) — sans lui, l'image démarre puis plante immédiatement avec `Cannot find module`. Les deux cibles ont été construites et testées de bout en bout (inscription réelle, connexion, page bibliothèque) contre un PostgreSQL réel avant d'être committées ; ne pas simplifier ce contournement sans revalider de la même façon.

Test local sans VPS ni registre :

```bash
docker build --target web -t evolyfoot-web:local .
docker build --target migrator -t evolyfoot-migrator:local .
```

### Provisionnement VPS (une fois)

1. Un VPS Linux (Debian/Ubuntu) avec au moins 1 Go de RAM, Docker Engine et le plugin `docker compose` installés.
2. Un enregistrement DNS `A`/`AAAA` pointant le domaine choisi vers l'IP du VPS.
3. Ouvrir les ports 80 et 443 (Caddy, dans `docker-compose.yml`, obtient et renouvelle automatiquement le certificat TLS Let's Encrypt pour ce domaine — aucune configuration manuelle de certificat).
4. Créer un utilisateur de déploiement dédié (pas `root`), avec sa clé SSH ajoutée à `~/.ssh/authorized_keys` — c'est cette clé privée qui devient le secret GitHub `VPS_SSH_KEY`.
5. Cloner le dépôt sur le VPS (`git clone` en lecture seule suffit ; le workflow CD ne fait que `git pull`-équivalent implicite via les images, il ne pousse pas de code — en pratique il suffit que `docker-compose.yml`, `Caddyfile` et `.env` soient présents au chemin choisi).
6. Copier `.env.production.example` en `.env` à côté de `docker-compose.yml` sur le VPS, et le remplir (`IMAGE_REPO`, `POSTGRES_PASSWORD`, `DOMAIN`). `IMAGE_TAG` est géré ensuite par le workflow CD.
7. `docker login ghcr.io` sur le VPS avec un jeton GitHub ayant le droit `read:packages`, pour pouvoir tirer les images (privées par défaut) publiées par la CI.

### Secrets GitHub à configurer

Sur GitHub, créer un environnement `production` (Settings → Environments) — c'est lui qui porte l'approbation manuelle mentionnée dans la stratégie progressive — puis y ajouter ces secrets :

| Secret | Contenu |
| --- | --- |
| `VPS_HOST` | IP ou nom d'hôte du VPS |
| `VPS_USER` | Utilisateur de déploiement (pas `root`) |
| `VPS_SSH_KEY` | Clé privée SSH correspondant à la clé publique autorisée sur le VPS |
| `VPS_DEPLOY_PATH` | Chemin absolu sur le VPS contenant `docker-compose.yml`, `Caddyfile` et `.env` |
| `VPS_DOMAIN` | Le domaine configuré (pour la vérification de santé finale du workflow) |

`GITHUB_TOKEN` (fourni automatiquement par GitHub Actions) suffit pour publier les images sur GHCR ; aucun secret supplémentaire n'est nécessaire pour cette partie.

### Premier déploiement et déploiements suivants

1. Configurer le VPS et les secrets ci-dessus.
2. Lancer manuellement `.github/workflows/cd.yml` (onglet Actions → CD → Run workflow) — il construit et publie les images, puis se connecte en SSH pour exécuter les migrations et redémarrer les conteneurs.
3. Vérifier `https://<domaine>/api/health/database` (la dernière étape du workflow le fait déjà automatiquement et échoue le déploiement sinon).
4. Une fois ce parcours validé manuellement une première fois, remplacer le déclencheur `workflow_dispatch` par `push: branches: [master]` dans `cd.yml` pour un déploiement continu — l'approbation de l'environnement GitHub `production` reste le garde-fou avant l'étape `deploy`.

### Sauvegardes et supervision

Les sauvegardes automatisées de PostgreSQL et la supervision de l'application restent à mettre en place avant un usage de production réel — non couvertes par cette configuration de base.

## Déploiement mobile (EAS)

`apps/mobile/eas.json` définit trois profils :

- **`development`** — client de développement, distribution interne.
- **`preview`** — APK Android installable directement (sans passer par le Play Store), pour tester avant soumission.
- **`production`** — build signé, numéro de version auto-incrémenté, destiné aux stores.

Étapes (nécessitent un compte Expo/EAS, gratuit pour démarrer) :

1. `npm install -g eas-cli` puis `eas login`.
2. Depuis `apps/mobile/` : `eas init` (crée le projet EAS et remplit `extra.eas.projectId` dans `app.json`) puis `eas build:configure` si des ajustements sont proposés.
3. **Icônes et écran de démarrage manquants** : `app.json` ne référence encore aucune icône (`icon`, `splash`, `android.adaptiveIcon.foregroundImage`) — EAS utilisera des valeurs par défaut génériques tant qu'elles ne sont pas fournies. À faire avant une vraie soumission aux stores : ajouter les assets dans `apps/mobile/assets/` et les référencer dans `app.json`.
4. `eas build --platform android --profile preview` pour un premier APK de test, installable directement sur un appareil ou l'émulateur.
5. Quand prêt pour les stores : `eas build --platform ios --profile production` et `eas build --platform android --profile production`, en ayant au préalable créé les comptes Apple Developer Program et Google Play Console (payants, à la charge du porteur du projet).
6. `eas submit` (configuré via le profil `submit.production` de `eas.json`) envoie le build vers TestFlight (iOS) ou la piste interne Google Play (Android) — les identifiants de soumission (App Store Connect API key, service account Google Play) sont à fournir au moment de la première soumission, jamais committés.

### Checklist avant soumission aux stores

- [ ] Icônes et splash screen définis dans `app.json`.
- [ ] Politique de confidentialité publiée et son URL renseignée (obligatoire pour les deux stores dès qu'une app gère des comptes utilisateurs).
- [ ] Fiche store (captures d'écran, description, catégorie) préparée pour App Store Connect et Google Play Console.
- [ ] `EXPO_PUBLIC_API_URL` (voir `apps/mobile/.env.example`) pointé vers le VPS de production, pas `10.0.2.2`/localhost, au moment du build `production`.
- [ ] Testé sur un vrai appareil via le profil `preview` avant de soumettre un build `production`.

## Déploiement VPS PostgreSQL (historique)

Le déploiement de la fondation de persistance suit cet ordre, sur une fenêtre de maintenance et avec les secrets fournis par l’environnement VPS :

1. Sauvegarder la base de données existante et vérifier que la restauration est possible.
2. Déployer l’image ou l’artefact applicatif.
3. Exécuter une seule fois `prisma migrate deploy` pour cette version (par exemple `pnpm db:migrate:deploy` dans l’artefact déployé, ou le service `migrate` de `docker-compose.yml`).
4. Démarrer l’application.
5. Appeler `GET /api/health/database` depuis le réseau autorisé et vérifier la réponse saine.

PostgreSQL ne doit pas exposer de port public : seul le port de l’application (via Caddy) est exposé, et l’application accède à la base via le réseau privé du VPS. Les mots de passe et `DATABASE_URL` de production restent dans le gestionnaire de secrets de l’environnement, jamais dans le dépôt ou les journaux.
