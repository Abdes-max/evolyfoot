import type { PublicEducator } from "./auth";
import { hitRateLimit, minute } from "./rate-limit";

const photonUrl = "https://photon.komoot.io/api/";
const maxResults = 5;
const minQueryLength = 3;
const maxQueryLength = 120;
const timeoutMs = 4000;

interface PhotonProperties {
  name?: string;
  housenumber?: string;
  street?: string;
  postcode?: string;
  city?: string;
  country?: string;
}

// Une ligne lisible : le nom du lieu, sa rue, puis le code postal et la ville.
function toPlaceLabel(properties: PhotonProperties): string {
  const street = [properties.housenumber, properties.street].filter(Boolean).join(" ");
  const city = [properties.postcode, properties.city].filter(Boolean).join(" ");
  return [...new Set([properties.name, street, city].filter(Boolean))].join(", ");
}

export async function searchPlaces(query: string, fetcher: typeof fetch = fetch): Promise<string[]> {
  const params = new URLSearchParams({ q: query, lang: "fr", limit: String(maxResults), lat: "46.6", lon: "2.4" });
  const response = await fetcher(`${photonUrl}?${params}`, {
    headers: { "user-agent": "EvolyFoot (https://evolyfoot.com)" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    return [];
  }
  const body = (await response.json()) as { features?: Array<{ properties?: PhotonProperties }> };
  const labels = (body.features ?? []).map((feature) => toPlaceLabel(feature.properties ?? {})).filter(Boolean);
  return [...new Set(labels)];
}

export function createSearchPlacesHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  search: (query: string) => Promise<string[]>,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }

    if (hitRateLimit(`places:${educator.id}`, 60, minute) !== null) {
      return Response.json({ places: [] });
    }

    const query = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, maxQueryLength);
    if (query.length < minQueryLength) {
      return Response.json({ places: [] });
    }

    // Le service de recherche est un confort : son absence laisse la saisie libre.
    try {
      return Response.json({ places: await search(query) });
    } catch (error) {
      log(error);
      return Response.json({ places: [] });
    }
  };
}
