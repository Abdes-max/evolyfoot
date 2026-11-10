// Compte joueur de démonstration pour les captures d'EvolyFoot Player : un joueur de l'effectif du coach de
// démonstration, invité puis rattaché à un compte, avec une évaluation, un match joué et des rendez-vous à venir,
// pour que les écrans montrent une vraie utilisation de l'appli. Créé sur l'API locale uniquement.
import { randomBytes } from "node:crypto";

async function call(api, path, { token, method = "GET", body } = {}) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-client-platform": "mobile",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

const isoIn = (days, hour) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

/** Prépare l'équipe du coach de démonstration (matchs, tournoi, séance convoquée) et renvoie la session d'un joueur. */
export async function createDemoPlayer(api, coachToken) {
  const roster = await call(api, "/api/roster", { token: coachToken });
  const player = roster.players[0];

  // Fiche du joueur : poste, numéro, pied fort (affichés sur sa carte).
  await call(api, `/api/roster/${player.id}`, {
    token: coachToken,
    method: "PATCH",
    body: { position: "Milieu", jerseyNumber: "8", preferredFoot: "Droit" },
  }).catch(() => undefined);

  // Évaluations (la carte du joueur affiche la dernière).
  await call(api, "/api/player-evaluations", {
    token: coachToken,
    method: "POST",
    body: { playerId: player.id, scores: { technique: 7, passe: 6, vitesse: 8, physique: 6, tactique: 7, mental: 8, tir: 6 } },
  }).catch(() => undefined);

  // Un match à venir (convoqué) et un match joué, un tournoi.
  const upcoming = await call(api, "/api/matches", {
    token: coachToken,
    method: "POST",
    body: {
      opponent: "US Vallée",
      dateLabel: "Samedi",
      venue: "home",
      gameFormat: 8,
      formationId: "3-3-1",
      date: isoIn(4, 14),
      location: "Stade Marius Requier",
      selectedPlayerIds: null,
    },
  });
  await call(api, `/api/matches/${upcoming.match.id}/convoke`, { token: coachToken, method: "POST" });
  // Un match déjà joué, avec un but et une passe du joueur.
  const played = await call(api, "/api/matches", {
    token: coachToken,
    method: "POST",
    body: {
      opponent: "FC Horizon",
      dateLabel: "Samedi dernier",
      venue: "away",
      gameFormat: 8,
      formationId: "3-3-1",
      date: isoIn(-6, 14),
      location: "Stade municipal",
      selectedPlayerIds: null,
    },
  });
  await call(api, `/api/matches/${played.match.id}/played`, {
    token: coachToken,
    method: "POST",
    body: {
      attendance: roster.players
        .slice(0, 11)
        .map((entry) => ({ playerId: entry.id, playerName: `${entry.firstName} ${entry.lastName}`, present: true, status: "present" })),
    },
  }).catch(() => undefined);
  await call(api, `/api/matches/${played.match.id}/result`, {
    token: coachToken,
    method: "PUT",
    body: { goalsFor: 3, goalsAgainst: 1, playerStats: [{ playerId: player.id, playerName: `${player.firstName} ${player.lastName}`, goals: 1, assists: 1 }] },
  }).catch(() => undefined);
  await call(api, "/api/tournaments", {
    token: coachToken,
    method: "POST",
    body: { name: "Tournoi de la Saint-Martin", dateLabel: "Dimanche", date: isoIn(11, 9), location: "Gymnase Jean Moulin" },
  }).catch(() => undefined);

  // Compte joueur lié à ce joueur, par invitation.
  const invite = await call(api, "/api/invites", { token: coachToken, method: "POST", body: { playerId: player.id } });
  const inviteToken = invite.url.split("/").pop();
  const suffix = randomBytes(4).toString("hex");
  const email = `demo-joueur-${suffix}@evolyfoot.test`;
  const password = randomBytes(12).toString("hex");
  await call(api, "/api/auth/register-player", { method: "POST", body: { token: inviteToken, email, password, displayName: "Parent de Lucas" } });
  // L'inscription par invitation ouvre une session par cookie : l'appli mobile se connecte par jeton.
  const { sessionToken: token } = await call(api, "/api/auth/login", { method: "POST", body: { email, password } });

  // Le coach accepte la demande de suivi du compte, comme il le fait depuis la fiche du joueur.
  const tutors = await call(api, `/api/roster/${player.id}/tuteurs`, { token: coachToken });
  for (const request of tutors.requests ?? []) {
    await call(api, `/api/roster/${player.id}/tuteurs`, { token: coachToken, method: "POST", body: { requestId: request.id, accept: true } });
  }

  return { token, playerName: `${player.firstName} ${player.lastName}` };
}
