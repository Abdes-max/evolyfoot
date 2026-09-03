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

**État actuel : le web est déployé et le déploiement continu est actif.** Bootstrap VPS fait, premier déploiement validé le 3 septembre 2026, `cd.yml` se déclenche désormais sur chaque `push` dans `master`. Reste : brancher le Caddy partagé côté arena-pulse (section dédiée ci-dessous) pour que `evolyfoot.com` soit joignable depuis l'extérieur. Le mobile (`apps/mobile/eas.json`) reste en attente des comptes Apple Developer / Google Play / Expo — voir la section dédiée plus bas.

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

### Bootstrap initial sur le VPS — fait le 3 septembre 2026

Exécuté directement sur le VPS (le workflow CD suppose que le dépôt y est déjà cloné) :

```bash
docker network create edge          # idempotent : ne rien faire si déjà créé côté arena-pulse
mkdir -p /opt/evolyfoot
cd /opt/evolyfoot
git clone https://github.com/Abdes-max/evolyfoot.git .
cp .env.production.example .env
sed -i "s/change-me/$(openssl rand -base64 24 | tr -d '=+/')/" .env   # mot de passe généré, jamais affiché
docker compose up -d --build
docker exec evolyfoot-web wget -qO- http://127.0.0.1:3000/api/health/database   # web n'est pas publié sur l'hôte
```

Piège rencontré et corrigé : la branche par défaut du dépôt GitHub était restée sur une ancienne branche de travail (`agent/initialize-platform`) plutôt que `master`, donc un `git clone` nu atterrissait sur cette branche obsolète — sans `Dockerfile` ni `.env.production.example`. Corrigé une fois pour toutes (Settings → General → Default branch → `master`) ; un `git clone` nu suffit désormais.

### Secrets GitHub (déjà configurés)

L'environnement `production` (Settings → Environments) porte ces secrets, déjà en place :

| Secret | Contenu |
| --- | --- |
| `DEPLOY_HOST` | `186.240.151.40` |
| `DEPLOY_USER` | `root` |
| `DEPLOY_SSH_KEY` | Clé privée SSH correspondant à une clé publique autorisée sur le VPS |
| `DEPLOY_PORT` | Port SSH (`22` par défaut, optionnel) |
| `DEPLOY_PATH` | `/opt/evolyfoot` |
| `DEPLOY_DOMAIN` | `evolyfoot.com` (pour la vérification de santé finale du workflow) |

Cet environnement **ne porte aucune règle de protection** (pas d'approbateur requis, pas de délai) : rien ne met en pause un déploiement déclenché automatiquement avant l'étape `deploy` elle-même. Si une approbation manuelle est un jour souhaitée, l'ajouter explicitement dans Settings → Environments → production → Protection rules.

### Premier déploiement et déploiements suivants

1. Bootstrap fait (section ci-dessus), secrets configurés — **fait et validé le 3 septembre 2026** : `docker compose up -d --build` sur le VPS a construit les images, `migrate` a réussi, `web` est sain, `GET /api/health/database` répond `{"status":"ok"}` en interne au conteneur.
2. `cd.yml` se déclenche désormais automatiquement sur chaque `push` dans `master` (en plus du déclenchement manuel `workflow_dispatch`, toujours disponible) : SSH, `git fetch`/`reset --hard origin/master`, `docker compose up -d --build`, puis vérification `https://evolyfoot.com/api/health/database` (le déploiement échoue si cette vérification échoue).
3. **Reste bloquant avant que cette vérification externe ne passe** : le bloc Caddy côté arena-pulse (section ci-dessus) n'est pas encore appliqué — tant que ce n'est pas fait, `evolyfoot.com` n'est pas joignable depuis l'extérieur et l'étape 2 du workflow échoue à la vérification de santé (le déploiement lui-même, lui, réussit bien : les conteneurs tournent et sont sains).

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

### Déploiement continu mobile — terrain prêt côté code, inerte tant que les comptes manquent

`.github/workflows/mobile-cd.yml` reproduit ce même parcours (`eas build --platform all --profile production --non-interactive --auto-submit`) automatiquement à chaque `push` dans `master` touchant le mobile ou ses dépendances partagées (`packages/domain`, `packages/design-tokens`). Il échoue proprement dès sa première étape tant que les comptes et secrets ci-dessous ne sont pas en place — aucun risque de déclenchement accidentel avant.

Reste à faire, une seule fois, en local et de façon interactive (EAS ne permet pas de générer des identifiants Apple/Google en mode non-interactif pour un premier build) :

1. Créer le compte Expo/EAS (gratuit), Apple Developer Program (99$/an) et Google Play Console (25$ une fois) — paiement/identité du porteur du projet, hors périmètre d'un agent.
2. `npm install -g eas-cli && eas login`, puis depuis `apps/mobile/` : `eas build:configure`.
3. `eas credentials` pour générer/importer les certificats iOS et le keystore Android.
4. Renseigner `submit.production.ios` dans `apps/mobile/eas.json` (`appleId`, `ascAppId`, `appleTeamId`) — `submit.production.android` pointe déjà vers `./google-service-account.json` (écrit par le workflow depuis le secret ci-dessous, jamais committé).
5. Créer un token d'accès Expo (expo.dev → compte → Access Tokens) et un compte de service Google Play (Play Console → Configuration → Accès API, export JSON), puis les ajouter comme secrets GitHub sur l'environnement `production` : `EXPO_TOKEN` et `GOOGLE_SERVICE_ACCOUNT_JSON`.
6. Icônes/splash screen (point suivant) avant toute vraie soumission aux stores.

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
