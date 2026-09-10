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

// Pages accessibles sans session : le site vitrine (voir marketing-routes.ts) et les deux
// formulaires d'authentification (il faut bien pouvoir atteindre /connexion pour obtenir une
// session). Tout le reste de l'application web (le tableau de bord vit sur /app) est protégé au
// même niveau que le mobile (AuthGate dans apps/mobile/app/_layout.tsx).
const AUTH_PATHS = ["/connexion", "/inscription"];

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
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
    // Tout sauf les routes API (chacune vérifie déjà sa propre session et renvoie 401/403 --
    // /api/auth/* doit d'ailleurs rester joignable pour pouvoir se connecter), les fichiers
    // statiques Next.js et le favicon.
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
