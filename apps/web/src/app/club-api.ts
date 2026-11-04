import type { PersonalExercise } from "@evolyfoot/domain";

// Club partagé de l'éducateur (GET /api/club) et exercices des autres membres (GET /api/club/exercises).
export interface ClubInfo {
  id: string;
  name: string;
  joinCode: string;
  members: { id: string; displayName: string }[];
}

export interface SharedExercise extends PersonalExercise {
  authorName: string;
}

// `undefined` si le compte n'a pas accès aux clubs (adjoint) ou si la requête échoue, `null` hors club.
export async function loadClub(): Promise<ClubInfo | null | undefined> {
  const response = await fetch("/api/club").catch(() => null);
  if (!response?.ok) {
    return undefined;
  }
  const body = await response.json().catch(() => null);
  return body?.club ?? null;
}

// Rejoindre (`{ code }`) ou créer (`{ name }`) : le club, ou le message d'erreur à afficher.
export async function saveClub(body: { code: string } | { name: string }): Promise<ClubInfo | string> {
  const response = await fetch("/api/club", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  const result = await response?.json().catch(() => null);
  if (response?.ok && result?.club) {
    return result.club;
  }
  return typeof result?.error === "string" ? result.error : "Le club n’a pas pu être enregistré.";
}
