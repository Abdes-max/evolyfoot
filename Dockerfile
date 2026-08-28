# Image de production pour apps/web (Next.js), construite depuis la racine du monorepo
# pnpm/Turborepo. Voir docs/delivery.md pour le déroulé de déploiement complet.
#
# Cibles :
#   web      → serveur Next.js autonome (docker build --target web)
#   migrator → exécute `prisma migrate deploy` une fois, puis quitte (--target migrator)

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

# --- Dépendances : installation unique pour tout le workspace pnpm. ---
# Une seule COPY complète (pas d'optimisation manifest-first) : plus simple à maintenir
# qu'un COPY par package.json de workspace, au prix d'un cache Docker moins fin.
FROM base AS deps
COPY . .
RUN pnpm install --frozen-lockfile

# --- Build : génère le client Prisma puis la sortie autonome de Next.js. ---
FROM deps AS builder
RUN pnpm --filter @evolyfoot/database generate
RUN pnpm --filter @evolyfoot/web build

# --- Migrator : image légère qui ne fait qu'exécuter les migrations puis quitter. ---
# Réutilise `deps` (pnpm + le CLI Prisma déjà installés) plutôt que l'image `web` allégée,
# qui ne contient pas le CLI Prisma ni les fichiers de migration.
FROM deps AS migrator
WORKDIR /repo
ENTRYPOINT ["pnpm", "--filter", "@evolyfoot/database", "exec", "prisma", "migrate", "deploy"]

# --- Web : serveur Next.js autonome, image finale minimale. ---
FROM node:22-alpine AS web
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
WORKDIR /app

COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /repo/node_modules/.pnpm/@swc+helpers@*/node_modules/@swc/helpers /tmp/swc-helpers

# Contournement d'un trou connu du traçage de sortie autonome de Next.js sous pnpm : le dossier
# canonique de @swc/helpers copié dans la sortie autonome est incomplet (fichiers esm/ manquants),
# ce qui casse la résolution ESM des paquets qui y pointent par lien symbolique relatif (ex. next).
# On le remplace entièrement par une copie complète du même paquet, copiée séparément ci-dessus.
RUN target="$(find ./node_modules/.pnpm -maxdepth 1 -iname '@swc+helpers@*')/node_modules/@swc/helpers" \
    && rm -rf "$target" \
    && cp -r /tmp/swc-helpers "$target" \
    && rm -rf /tmp/swc-helpers \
    && chown -R nextjs:nodejs /app

USER nextjs
WORKDIR /app/apps/web
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health/database').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
