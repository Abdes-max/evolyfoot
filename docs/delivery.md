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

### VPS et domaines réels

EvolyFoot est déployé sur un VPS Hostinger **partagé avec d'autres projets** (arena-pulse/TournArena, Kelto Studio) — pas une instance dédiée. Un seul Caddy, déjà en place pour ces autres projets, tourne sur les ports 80/443 ; EvolyFoot ne peut donc pas avoir son propre service Caddy et vient s'ajouter à celui qui existe déjà, sans jamais toucher au dépôt ni aux conteneurs des autres projets.

- VPS : `srv1882841.hstgr.cloud`, IPv4 `186.240.151.40`, IPv6 `2a02:4780:79:bdd3::1`, Ubuntu 24.04 avec Docker préinstallé, KVM 2 (2 vCPU / 8 Go RAM / 100 Go disque). Constaté à ~2,5 % CPU et ~1,3 Go de RAM utilisés par les autres projets — largement de la marge pour EvolyFoot, pas besoin d'un VPS séparé.
- Domaines `evolyfoot.com`, `.fr`, `.net`, `.org` déjà achetés. `evolyfoot.com` est le site principal (DNS `A`/`AAAA` déjà pointés vers le VPS ci-dessus) ; `.fr`/`.net`/`.org` redirigent en 301 vers `https://evolyfoot.com` via la redirection de domaine Hostinger — déjà configuré, rien à faire côté VPS pour ces trois-là.

### Caddy partagé — bloc à ajouter côté arena-pulse

`docker-compose.yml` d'EvolyFoot rejoint un réseau Docker externe `edge` (créé lors du bootstrap ci-dessous) et expose son conteneur web sous le nom fixe `evolyfoot-web`. Le Caddy existant doit être branché sur ce même réseau `edge` et recevoir un bloc de site pour `evolyfoot.com`.

**Ceci ne doit pas être fait en éditant le VPS à la main** (dérive entre le disque et le dépôt Git) : c'est un changement du dépôt **arena-pulse**, hors du périmètre d'EvolyFoot — à appliquer par qui gère ce dépôt, pas par ce dépôt-ci.

Dans `infra/deployment/Caddyfile` d'arena-pulse, ajouter :

```caddyfile
evolyfoot.com {
	encode gzip
	reverse_proxy evolyfoot-web:3000
}

www.evolyfoot.com {
	redir https://evolyfoot.com{uri} permanent
}
```

Dans `infra/deployment/docker-compose.prod.yml` d'arena-pulse, ajouter le réseau externe au service `caddy` :

```yaml
  caddy:
    # ... inchangé ...
    networks:
      - default
      - edge

networks:
  edge:
    external: true
```

Puis un `restart caddy` (pas `reload`, voir le commentaire de `deploy-prod.yml` d'arena-pulse sur pourquoi) pour que le nouveau bloc soit pris en compte.

### Bootstrap initial sur le VPS (une fois)

À exécuter directement sur le VPS (le workflow CD suppose que le dépôt y est déjà cloné) :

```bash
docker network create edge          # idempotent : ne rien faire si déjà créé côté arena-pulse
mkdir -p /opt/evolyfoot
cd /opt/evolyfoot
git clone https://github.com/<owner>/evolyfoot.git .
cp .env.production.example .env
# éditer .env : POSTGRES_PASSWORD au minimum
docker compose up -d --build
curl -s http://127.0.0.1:3000/... # web n'est pas publié sur l'hôte -- vérifier via `docker compose logs web` plutôt
```

### Secrets GitHub à configurer

Sur GitHub, créer un environnement `production` (Settings → Environments) — c'est lui qui porte l'approbation manuelle mentionnée dans la stratégie progressive — puis y ajouter ces secrets :

| Secret | Contenu |
| --- | --- |
| `DEPLOY_HOST` | `186.240.151.40` |
| `DEPLOY_USER` | Utilisateur de déploiement sur le VPS |
| `DEPLOY_SSH_KEY` | Clé privée SSH correspondant à une clé publique autorisée sur le VPS |
| `DEPLOY_PORT` | Port SSH (`22` par défaut, optionnel) |
| `DEPLOY_PATH` | `/opt/evolyfoot` (ou le chemin choisi au bootstrap) |
| `DEPLOY_DOMAIN` | `evolyfoot.com` (pour la vérification de santé finale du workflow) |

### Premier déploiement et déploiements suivants

1. Bootstrap fait (section ci-dessus), bloc Caddy ajouté côté arena-pulse, secrets configurés.
2. Lancer manuellement `.github/workflows/cd.yml` (onglet Actions → CD → Run workflow) — il se connecte en SSH, fait `git pull` puis `docker compose up -d --build` (`migrate` s'exécute et quitte avant que `web` ne démarre, comme le service `migrate` d'arena-pulse).
3. Vérifier `https://evolyfoot.com/api/health/database` (la dernière étape du workflow le fait déjà automatiquement et échoue le déploiement sinon).
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

PostgreSQL ne doit pas exposer de port public : seul le Caddy partagé (voir plus haut) est exposé sur 80/443, et l’application y accède via le réseau privé du VPS. Les mots de passe et `DATABASE_URL` de production restent dans le gestionnaire de secrets de l’environnement, jamais dans le dépôt ou les journaux.
