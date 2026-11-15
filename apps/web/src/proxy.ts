import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isMarketingPath } from "./marketing-routes";

// Duplique volontairement le nom du cookie plutôt que d'importer SESSION_COOKIE_NAME depuis
// ./server/auth : ce fichier-là importe @evolyfoot/database au niveau module (pour les classes
// d'erreurs), qui entraîne le client Prisma. Le Proxy Next.js tourne en runtime Node.js par
// défaut depuis la v16 (contrairement à l'ancien Middleware, en Edge), donc ce n'est plus une
// incompatibilité stricte -- mais ce fichier n'a besoin que d'une vérification bon marché de
// présence du cookie, jamais d'une validation de session côté base de données (déjà faite par
// chaque route API et chaque page via /api/auth/session) : autant rester indépendant de Prisma
// pour garder ce garde-fou rapide et sans dépendance lourde.
const SESSION_COOKIE_NAME = "evolyfoot_session";
// Cookie du superadmin (voir server/super-admin.ts), dupliqué pour la même raison.
const SUPER_ADMIN_COOKIE_NAME = "evolyfoot_superadmin";

// Pages accessibles sans session : le site vitrine (voir marketing-routes.ts) et les deux
// formulaires d'authentification (il faut bien pouvoir atteindre /connexion pour obtenir une
// session). Tout le reste de l'application web (le tableau de bord vit sur /app) est protégé au
// même niveau que le mobile (AuthGate dans apps/mobile/app/_layout.tsx).
const AUTH_PATHS = ["/connexion", "/inscription"];
// Largement au-dessus d'une photo de schéma ou de joueur, redimensionnée côté client.
const MAX_API_BODY_BYTES = 3_000_000;

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    return contentLength > MAX_API_BODY_BYTES ? NextResponse.json({ error: "Requête trop volumineuse." }, { status: 413 }) : NextResponse.next();
  }

  // Espace superadmin : sans cookie superadmin, retour à sa page de connexion (la session est revérifiée par chaque route API).
  if (pathname === "/super-admin" || pathname.startsWith("/super-admin/")) {
    if (pathname === "/super-admin/login" || request.cookies.has(SUPER_ADMIN_COOKIE_NAME)) {
      return NextResponse.next();
    }
    const login = request.nextUrl.clone();
    login.pathname = "/super-admin/login";
    login.search = "";
    return NextResponse.redirect(login);
  }

  if (isMarketingPath(pathname) || AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  if (request.cookies.has(SESSION_COOKIE_NAME)) {
    return NextResponse.next();
  }

  const destination = request.nextUrl.clone();
  destination.pathname = "/connexion";
  destination.search = "";
  return NextResponse.redirect(destination);
}

export const config = {
  matcher: [
    // Tout sauf les fichiers statiques Next.js. Les routes API passent ici pour le seul contrôle
    // de taille : chacune vérifie déjà sa propre session et renvoie 401/403. Restent exclus le favicon, et les fichiers SEO générés (sitemap.xml, robots.txt) qui
    // doivent rester publics pour les moteurs.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|sitemap.xml|robots.txt).*)",
  ],
};
