// Compte coach de démonstration pour les captures des fiches store : créé à chaque lancement sur
// l'API locale (jamais la production), avec une équipe, un effectif, un diagnostic et une saison
// lancée, pour que les écrans montrent une vraie utilisation de l'appli.
import { randomBytes } from "node:crypto";

const PLAYERS = [
  ["Lucas", "Martin"],
  ["Nathan", "Bernard"],
  ["Yanis", "Petit"],
  ["Inès", "Robert"],
  ["Adam", "Richard"],
  ["Léo", "Durand"],
  ["Sacha", "Moreau"],
  ["Rayan", "Laurent"],
  ["Jade", "Simon"],
  ["Noah", "Michel"],
  ["Ilyes", "Lefebvre"],
  ["Tom", "Garcia"],
  ["Lina", "Roux"],
  ["Hugo", "Fournier"],
];

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

export async function createDemoCoach(api, today = new Date()) {
  const suffix = randomBytes(4).toString("hex");
  const registered = await call(api, "/api/auth/register", {
    method: "POST",
    body: { email: `demo-${suffix}@evolyfoot.test`, password: randomBytes(12).toString("hex"), displayName: "Karim" },
  });
  const token = registered.sessionToken;

  await call(api, "/api/team", {
    token,
    method: "PUT",
    body: { name: "AS Les Lilas U11", ageGroup: "U11", gameFormat: 8, playerCount: PLAYERS.length, sessionsPerWeek: 2, trainingDays: ["Mardi", "Jeudi"] },
  });
  for (const [firstName, lastName] of PLAYERS) {
    await call(api, "/api/roster", { token, method: "POST", body: { firstName, lastName } });
  }
  await call(api, "/api/diagnostic", {
    token,
    method: "PUT",
    body: { availability: 3, scanning: 2, progression: 3, reactionAfterLoss: 2 },
  });

  // Saison commencée il y a 8 semaines (lundi), pour une grille déjà bien avancée.
  const start = new Date(today);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 7 * 8);
  const startDate = start.toISOString().slice(0, 10);
  await call(api, "/api/season-program", {
    token,
    method: "PUT",
    body: { priorities: ["Récupérer rapidement", "Progresser ensemble"], startDate },
  });

  return { token };
}
