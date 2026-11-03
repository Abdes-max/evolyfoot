// Limite de tentatives en mémoire : suffisant tant que le site tourne dans un seul conteneur. Un
// redémarrage remet les compteurs à zéro, ce qui reste acceptable pour freiner une attaque.
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const maxBuckets = 50_000;

export const minute = 60_000;
export const hour = 60 * minute;

export function resetRateLimits(): void {
  buckets.clear();
}

function purgeExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

// Renvoie le nombre de secondes à attendre si la limite est dépassée, sinon `null`.
export function hitRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): number | null {
  if (buckets.size >= maxBuckets) {
    purgeExpired(now);
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  bucket.count += 1;
  return bucket.count > limit ? Math.ceil((bucket.resetAt - now) / 1000) : null;
}

// Caddy ajoute l'adresse réelle en fin de liste : les valeurs précédentes viennent du client.
export function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",").at(-1)?.trim() || "inconnu";
}

function tooManyRequests(retryAfter: number): Response {
  return Response.json({ error: "Trop de tentatives. Réessaie dans quelques minutes." }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
}

export function limitByAddress(request: Request, scope: string, limit: number, windowMs: number): Response | null {
  const retryAfter = hitRateLimit(`${scope}:${clientAddress(request)}`, limit, windowMs);
  return retryAfter === null ? null : tooManyRequests(retryAfter);
}

// Connexion : compte par adresse et par couple adresse + e-mail, pour freiner les essais sur un
// compte sans permettre à un tiers de bloquer ce compte depuis une autre adresse.
export async function limitLogin(request: Request): Promise<Response | null> {
  const address = clientAddress(request);
  const body: unknown = await request
    .clone()
    .json()
    .catch(() => null);
  const rawEmail = (body as { email?: unknown } | null)?.email;
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  const retryAfter = hitRateLimit(`login:${address}`, 50, 15 * minute) ?? hitRateLimit(`login:${address}:${email}`, 10, 15 * minute);
  return retryAfter === null ? null : tooManyRequests(retryAfter);
}
