// Changer d'équipe change toutes les données déjà chargées par les écrans : rechargement complet
// de la page plutôt qu'une navigation côté client.
export function reloadAt(path: string): void {
  window.location.href = new URL(path, window.location.origin).href;
}

// Équipes d'un éducateur (GET /api/teams) : la première, puis les équipes ajoutées.
export interface TeamChoice {
  id: string;
  name: string | null;
  ageGroup: string | null;
  primary: boolean;
  active: boolean;
}

export function teamChoiceLabel(team: TeamChoice): string {
  if (!team.name) {
    return "Nouvelle équipe (à configurer)";
  }
  return team.ageGroup ? `${team.name} · ${team.ageGroup}` : team.name;
}

export async function listTeams(): Promise<TeamChoice[]> {
  const response = await fetch("/api/teams").catch(() => null);
  const body = response?.ok ? await response.json().catch(() => null) : null;
  return Array.isArray(body?.teams) ? body.teams : [];
}

export async function switchTeam(id: string): Promise<boolean> {
  const response = await fetch("/api/teams/active", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id }),
  }).catch(() => null);
  if (response?.ok) {
    reloadAt("/app");
  }
  return Boolean(response?.ok);
}

// La nouvelle équipe devient active : on enchaîne sur sa configuration.
export async function addTeam(): Promise<string | null> {
  const response = await fetch("/api/teams", { method: "POST" }).catch(() => null);
  if (response?.ok) {
    reloadAt("/onboarding");
    return null;
  }
  const body = await response?.json().catch(() => null);
  return typeof body?.error === "string" ? body.error : "L’équipe n’a pas pu être créée.";
}
