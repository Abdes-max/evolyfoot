import { lookup } from "node:dns/promises";
import { parseCalendarFile, type CalendarEvent } from "@evolyfoot/domain";
import { hitRateLimit, hour } from "./rate-limit";

// Récupération best-effort d'un flux de calendrier externe (.ics) auquel une équipe est abonnée
// (voir Team.calendarFeedUrl) : toute erreur (réseau, délai, format) renvoie simplement un tableau
// vide plutôt que d'échouer -- l'écran Matchs doit toujours s'afficher, flux disponible ou non.
const fetchTimeoutMs = 8000;
// Pas de streaming : un corps plus gros que ça est tronqué avant d'être analysé, suffisant contre
// un flux anormalement volumineux sans complexifier avec une lecture par morceaux.
const maxFeedChars = 2_000_000;
// Un coach ne doit pas pouvoir transformer l'ouverture répétée de l'écran Matchs en bélier contre
// une URL arbitraire.
const syncsPerHour = 30;

function isPrivateAddress(address: string): boolean {
  if (address === "127.0.0.1" || address === "::1" || address === "0.0.0.0") return true;
  if (/^10\./.test(address) || /^192\.168\./.test(address) || /^169\.254\./.test(address)) return true;
  const privateClassB = /^172\.(\d+)\./.exec(address);
  if (privateClassB && Number(privateClassB[1]) >= 16 && Number(privateClassB[1]) <= 31) return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(address) || /^fe80:/i.test(address)) return true;
  return false;
}

// Rejette une cible qui ne serait pas une URL http(s) publique -- le coach saisit cette URL
// lui-même, jamais de confiance aveugle envers une adresse arbitraire (garde anti-SSRF).
async function isSafeFeedUrl(url: URL): Promise<boolean> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }
  try {
    const { address } = await lookup(url.hostname);
    return !isPrivateAddress(address);
  } catch {
    return false;
  }
}

export async function fetchCalendarFeed(educatorId: string, feedUrl: string): Promise<CalendarEvent[]> {
  if (hitRateLimit(`calendar-feed:${educatorId}`, syncsPerHour, hour) !== null) {
    return [];
  }
  let url: URL;
  try {
    url = new URL(feedUrl);
  } catch {
    return [];
  }
  if (!(await isSafeFeedUrl(url))) {
    return [];
  }
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(fetchTimeoutMs), headers: { accept: "text/calendar, text/plain" } });
    if (!response.ok) {
      return [];
    }
    const content = (await response.text()).slice(0, maxFeedChars);
    return parseCalendarFile(content);
  } catch {
    return [];
  }
}
