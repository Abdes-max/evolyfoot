# Livraison et environnements

## Gouvernance Git

- `master` est la branche de production et doit être protégée.
- Toute modification passe par une branche `agent/*` ou `feature/*` et une pull request.
- La CI doit réussir avant le merge.
- Le merge recommandé est **squash and merge**.
- Aucun déploiement de production ne part d'une branche de travail.

## Cibles

| Cible     | Source                          | Outil prévu                               |
| --------- | ------------------------------- | ----------------------------------------- |
| Web / API | `master`                        | image Docker vers VPS                     |
| iOS       | `master`                        | Xcode sur runner macOS puis TestFlight    |
| Android   | tag de version issu de `master` | EAS Build puis piste interne / Play Store |

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

**E-mail transactionnel.** Inscription, confirmation d'adresse et mot de passe oublié passent par `apps/web/src/server/mailer.ts`.

- **En local : MailHog.** `docker start evolyfoot-mailhog` (ou `docker run -d --name evolyfoot-mailhog -p 1025:1025 -p 8025:8025 mailhog/mailhog`), messages visibles sur http://localhost:8025. Aucune variable à définir : le mailer vise `127.0.0.1:1025` par défaut.
- **En production : Brevo.** Renseigner dans le `.env` du VPS, jamais dans le dépôt : `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, `SMTP_USER` (identifiant SMTP du compte Brevo), `SMTP_PASSWORD` (clé SMTP Brevo, pas le mot de passe du compte) et `SMTP_FROM` (expéditeur dont le domaine est authentifié dans Brevo, par exemple `EvolyFoot <no-reply@evolyfoot.com>`). Puis `docker compose up -d` pour recharger l'environnement. Sans `SMTP_HOST`, l'envoi est abandonné et l'erreur `SMTP_HOST manquant` apparaît dans les journaux du conteneur `web`.

### Secrets GitHub (déjà configurés)

L'environnement `production` (Settings → Environments) porte ces secrets, déjà en place :

| Secret           | Contenu                                                              |
| ---------------- | -------------------------------------------------------------------- |
| `DEPLOY_HOST`    | `186.240.151.40`                                                     |
| `DEPLOY_USER`    | `root`                                                               |
| `DEPLOY_SSH_KEY` | Clé privée SSH correspondant à une clé publique autorisée sur le VPS |
| `DEPLOY_PORT`    | Port SSH (`22` par défaut, optionnel)                                |
| `DEPLOY_PATH`    | `/opt/evolyfoot`                                                     |
| `DEPLOY_DOMAIN`  | `evolyfoot.com` (pour la vérification de santé finale du workflow)   |

Cet environnement **ne porte aucune règle de protection** (pas d'approbateur requis, pas de délai) : rien ne met en pause un déploiement déclenché automatiquement avant l'étape `deploy` elle-même. Si une approbation manuelle est un jour souhaitée, l'ajouter explicitement dans Settings → Environments → production → Protection rules.

### Premier déploiement et déploiements suivants

1. Bootstrap fait (section ci-dessus), secrets configurés — **fait et validé le 3 septembre 2026** : `docker compose up -d --build` sur le VPS a construit les images, `migrate` a réussi, `web` est sain, `GET /api/health/database` répond `{"status":"ok"}` en interne au conteneur.
2. `cd.yml` se déclenche désormais automatiquement sur chaque `push` dans `master` (en plus du déclenchement manuel `workflow_dispatch`, toujours disponible) : SSH, `git fetch`/`reset --hard origin/master`, `docker compose up -d --build`, puis vérification `https://evolyfoot.com/api/health/database` (le déploiement échoue si cette vérification échoue).
3. **Reste bloquant avant que cette vérification externe ne passe** : le bloc Caddy côté arena-pulse (section ci-dessus) n'est pas encore appliqué — tant que ce n'est pas fait, `evolyfoot.com` n'est pas joignable depuis l'extérieur et l'étape 2 du workflow échoue à la vérification de santé (le déploiement lui-même, lui, réussit bien : les conteneurs tournent et sont sains).

### Sauvegardes et supervision

Les sauvegardes automatisées de PostgreSQL et la supervision de l'application restent à mettre en place avant un usage de production réel — non couvertes par cette configuration de base.

## Compte superadmin (web)

Compte séparé des éducateurs, accessible sur `/super-admin/login` (cookie `evolyfoot_superadmin`, 8 h, essais limités à 5 par 15 min). Il n'existe aucune inscription : le compte se crée à la main, sur le serveur, avec un mot de passe saisi dans le terminal (12 caractères minimum, jamais en argument) :

```bash
docker compose run --rm -it --entrypoint node migrate scripts/create-super-admin.mjs --email vous@exemple.fr --name "Votre nom"
```

(le service `migrate` embarque le dépôt complet et la `DATABASE_URL` de production). Rotation du mot de passe : onglet « Compte » de l'espace superadmin. Chaque action (suspension, suppression, « se connecter en tant que »…) est inscrite dans l'onglet « Journal ». Pendant une connexion « en tant que » (30 min, bandeau visible), la suppression de compte, le changement de mot de passe et la facturation sont refusés.

## Paiement (Stripe)

Abonnement des coachs : essai de 14 jours sans carte, puis paiement mensuel ou à la saison (prix dans
`packages/domain/src/billing.ts`). Le code est dans `apps/web/src/server/billing.ts` et la page `/abonnement`.

Mise en service, à faire dans le tableau de bord Stripe (mode test d'abord, puis mode live) :

1. **Clé secrète** : Développeurs → Clés API → clé secrète (`sk_test_...` puis `sk_live_...`).
2. **Webhook** : Développeurs → Webhooks → ajouter un endpoint `https://evolyfoot.com/api/billing/webhook`
   avec les événements `customer.subscription.created`, `customer.subscription.updated` et
   `customer.subscription.deleted`. Noter le secret de signature (`whsec_...`).
3. **Portail client** : Paramètres → Facturation → Portail client → activer et enregistrer (moyen de paiement,
   factures, résiliation, changement de rythme si souhaité).
4. Renseigner `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` dans les secrets GitHub du dépôt (environnement
   `production`) ou dans le `.env` du VPS, puis redéployer.

Les produits et les prix n'ont pas à être créés à la main : le serveur les crée au premier paiement et
les retrouve ensuite par leur clé (`evolyfoot_base_monthly`, `evolyfoot_team_season`...). Les codes promo
Stripe sont acceptés sur la page de paiement (coupon de lancement).

Passage du test au live : annuler d’abord, en mode test, les abonnements de test (le webhook les marque
résiliés), puis remplacer les deux secrets par les valeurs live (nouveau webhook créé en mode live, portail
client à réactiver en live) et redéployer. Les clients Stripe de test restés en base sont recréés au premier
paiement live.

Tant que l'accès n'est pas bloqué (`BILLING_ENFORCED` absent ou `false`, variable GitHub du même nom),
un essai terminé n'empêche rien : la barre latérale invite seulement à s'abonner. À `true`, un coach non
abonné dont l'essai est fini est renvoyé vers `/abonnement` (le profil reste ouvert). Les coachs inscrits
avant la mise en service du paiement ont 14 jours d'essai à partir de la migration `add_billing`.

Les applis iOS ne proposent pas d'achat ni de lien de paiement (règle 3.1.1 de l'App Store) : l'abonnement
se prend sur le web.

## Déploiement mobile (EAS)

Deux applications, chacune avec son projet EAS et ses fiches sur les stores :

| Application      | Dossier              | Identifiant iOS et Android | Comptes                                           |
| ---------------- | -------------------- | -------------------------- | ------------------------------------------------- |
| EvolyFoot Coach  | `apps/mobile`        | `com.evolyfoot.coach`      | Éducateurs                                        |
| EvolyFoot Player | `apps/mobile-player` | `com.evolyfoot.player`     | Joueurs et tuteurs, sur invitation de l'éducateur |

Les étapes ci-dessous sont à faire une fois pour chaque dossier ; `eas.json` y est identique.

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

### iOS : TestFlight à chaque merge, sans EAS

`.github/workflows/deploy-ios.yml` reprend la méthode d'arena-pulse, sur le même compte Apple Developer. Pour chaque app, il :

- régénère le projet natif (`expo prebuild`, `ios/` jamais commité) ;
- signe l'archive avec le certificat de distribution du compte ;
- l'envoie sur TestFlight avec la clé API App Store Connect.

Il reste vert et ne fait rien tant que ses secrets manquent.

**Durée.** Un build complet à froid dépasse 25 minutes ; le workflow réduit l'attente de trois façons :

- un job `plan` ne construit que les applis concernées par le push : Coach pour `apps/mobile`, Player pour `apps/mobile-player`, les deux pour le code partagé (`packages/domain`, hors fichiers de test, `packages/design-tokens`, `pnpm-lock.yaml`) ;
- il n'y a pas de file d'attente : plusieurs merges de suite construisent en parallèle, le numéro de build étant le numéro de run, unique ;
- la compilation des Pods passe par ccache, mis en cache entre les runs (clé : appli et lockfile). Le premier build après un changement du lockfile est à froid, les suivants beaucoup plus courts.

Lancement manuel : choisir l'appli (`apps`) et décocher « Envoyer sur TestFlight » pour archiver sans rien publier, par exemple pour mesurer la durée.

À faire une fois :

1. **developer.apple.com, Identifiers** : créer les App IDs `com.evolyfoot.coach` et `com.evolyfoot.player`, avec la capacité Push Notifications.
2. **Profiles** : créer un profil « App Store Connect » par App ID, avec le certificat de distribution déjà utilisé par les autres applis du compte.
3. **App Store Connect, Apps, +** : créer EvolyFoot Coach et EvolyFoot Player sur ces bundle IDs. Créer aussi un groupe de test interne dans TestFlight.
4. **Secrets du dépôt GitHub** : leur liste est en en-tête du workflow.
   - Le certificat `.p12`, la clé API et le Team ID reprennent les valeurs d'arena-pulse.
   - Seuls les deux profils de provisioning sont nouveaux.
5. **Lancer le workflow** : Actions → Deploy iOS to TestFlight → Run workflow, ou merger un changement mobile.

`app.json` déclare `usesNonExemptEncryption: false`, ce qui évite le blocage « Missing Compliance » sur chaque build. `expo-notifications` y est en mode `production`, ce qui correspond à l'entitlement push d'un profil App Store.

### Déploiement continu Android (Google Play)

Même méthode qu'arena-pulse (TournArena), sans EAS ni Fastlane :

- `.github/workflows/deploy-android.yml` construit Coach et Player sur un runner Linux à chaque merge qui touche le mobile (seulement les applis concernées). `expo prebuild` régénère `android/`, le `versionCode` est le numéro de run, l'App Bundle est signé avec la clé d'upload puis envoyé sur la **piste de test interne** (jamais la production). L'App Bundle reste aussi dans les artefacts du run.
- `.github/workflows/promote-android-production.yml` (manuel) promeut vers la production une release déjà testée sur la piste interne, sans reconstruire (`scripts/play-store/promote-android-release.mjs`).

À faire une seule fois :

1. **Play Console → Créer une application** : « EvolyFoot Coach » (`com.evolyfoot.coach`) et « EvolyFoot Player » (`com.evolyfoot.player`). Le nom de package est définitif.
2. **Clé d'upload** : un keystore PKCS12 généré en local (`keytool -genkeypair -v -storetype PKCS12 -keystore evolyfoot-upload.keystore -alias evolyfoot-upload -keyalg RSA -keysize 2048 -validity 9125`). Une seule clé pour les deux applis ; Google signe ensuite avec sa propre clé (Play App Signing). À sauvegarder hors du dépôt.
3. **Compte de service** : celui d'arena-pulse convient (même compte Play Console). Play Console → Utilisateurs et autorisations : lui donner le droit de publier sur les deux applis.
4. **Secrets du dépôt** (mêmes noms qu'arena-pulse) : `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`.
5. **Fiche Play Console** (pas d'API pour la première fois) : fiche principale, captures, icône 512 px, image de présentation 1024 × 500, classification du contenu, public cible, sécurité des données, accès à l'appli (compte de démo pour Player), publicités : non.

Tant que l'appli n'a jamais été publiée, Google n'accepte que des releases en brouillon : le workflow les envoie en `draft`. Une fois la fiche validée, la variable de dépôt `ANDROID_RELEASE_STATUS=completed` les publie directement aux testeurs internes.

Notifications push Android : `expo-notifications` a besoin d'un projet Firebase (`google-services.json` dans chaque appli) et des identifiants FCM côté Expo. Sans eux, l'appli fonctionne mais ne reçoit pas de notifications.

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
