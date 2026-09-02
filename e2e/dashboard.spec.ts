import { expect, test } from "@playwright/test";
import { diagnosticCriteria } from "@evolyfoot/domain";

test("l'éducateur accède au fil directeur de sa semaine", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Bonjour Abdes," })).toBeVisible();
  await expect(page.getByText("Créer des solutions autour du porteur")).toBeVisible();
  await expect(page.getByRole("link", { name: /ouvrir la séance/i })).toBeVisible();
  await expect(page.getByText("Garde le même thème, change la contrainte.")).toBeVisible();
});

test("l’éducateur configure son équipe avant le diagnostic", async ({ page }) => {
  // La persistance réelle (session + PostgreSQL) est couverte par les tests d'intégration
  // de packages/database et apps/web/src/server ; ce parcours E2E simule un éducateur déjà
  // connecté pour vérifier le câblage client du formulaire sans dépendre d'une base de données.
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({ json: { educator: { id: "e2e-educator", email: "coach@example.test", displayName: "Coach E2E" } } }),
  );
  await page.route("**/api/team", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ json: { profile: null } });
    }
    return route.fulfill({ json: { profile: JSON.parse(route.request().postData() ?? "{}") } });
  });

  await page.goto("/onboarding");
  await page.getByLabel("Nom de l’équipe").fill("FC Horizon");
  await page.getByRole("button", { name: "Mar" }).click();
  await page.getByRole("button", { name: "Jeu" }).click();
  await page.getByRole("button", { name: /valider mon équipe/i }).click();
  await expect(page.getByRole("status")).toContainText("Équipe prête");
});

test("l’éducateur gère l’effectif nominatif de son équipe", async ({ page }) => {
  // Même approche que le test d'onboarding ci-dessus : la persistance réelle est couverte par
  // les tests d'intégration, ce parcours vérifie le câblage client (ajout, renommage, retrait).
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({ json: { educator: { id: "e2e-educator", email: "coach@example.test", displayName: "Coach E2E" } } }),
  );
  await page.route("**/api/team", (route) =>
    route.fulfill({ json: { profile: { name: "FC Horizon", ageGroup: "U12", gameFormat: 8, playerCount: 14, sessionsPerWeek: 2, trainingDays: ["Mardi", "Jeudi"] } } }),
  );

  let players: Array<{ id: string; name: string }> = [];
  await page.route("**/api/roster", (route) => {
    if (route.request().method() === "POST") {
      const player = { id: `player-${players.length + 1}`, name: JSON.parse(route.request().postData() ?? "{}").name };
      players = [...players, player];
      return route.fulfill({ status: 201, json: { player } });
    }
    return route.fulfill({ json: { players } });
  });
  await page.route("**/api/roster/*", (route) => {
    const id = route.request().url().split("/").pop();
    if (route.request().method() === "PATCH") {
      const name = JSON.parse(route.request().postData() ?? "{}").name;
      players = players.map((player) => (player.id === id ? { ...player, name } : player));
      return route.fulfill({ json: { player: players.find((player) => player.id === id) } });
    }
    players = players.filter((player) => player.id !== id);
    return route.fulfill({ json: { status: "ok" } });
  });

  await page.goto("/equipe");
  await expect(page.getByText(/foot à 8/i)).toBeVisible();

  await page.getByLabel("Ajouter un joueur").fill("Kylian");
  await page.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByText("Kylian")).toBeVisible();

  await page.getByRole("button", { name: "Renommer Kylian" }).click();
  await page.getByLabel("Renommer Kylian").fill("Ousmane");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Ousmane")).toBeVisible();

  await page.getByRole("button", { name: "Retirer Ousmane" }).click();
  await expect(page.getByText("Ousmane")).not.toBeVisible();
  await expect(page.getByText("Aucun joueur pour l’instant.")).toBeVisible();
});

test("le diagnostic révèle deux priorités de développement", async ({ page }) => {
  await page.goto("/diagnostic");
  await page.getByRole("button", { name: "Réagir après la perte : Rarement" }).click();
  await page.getByRole("button", { name: "Voir mes priorités" }).click();
  await expect(page.getByRole("status")).toContainText("Récupérer rapidement");
});

test("le plan organise la progression sur quatre semaines", async ({ page }) => {
  await page.goto("/plan");

  await expect(page.getByRole("heading", { name: "Ton premier cycle est prêt." })).toBeVisible();
  await expect(page.getByText("S4", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /préparer la première séance/i })).toBeVisible();
});

test("le coach personnalise, valide puis observe sa séance", async ({ page }) => {
  // La persistance réelle (session + PostgreSQL) est couverte par les tests d'intégration de
  // packages/database et apps/web/src/server ; ce parcours E2E simule un éducateur déjà connecté
  // pour vérifier le câblage client de la validation de séance et d'observation sans dépendre
  // d'une base de données.
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({ json: { educator: { id: "e2e-educator", email: "coach@example.test", displayName: "Coach E2E" } } }),
  );
  await page.route("**/api/team", (route) => route.fulfill({ json: { profile: null } }));
  await page.route("**/api/diagnostic", (route) => route.fulfill({ json: { scores: null } }));
  await page.route("**/api/sessions", (route) =>
    route.fulfill({ status: 201, json: { session: JSON.parse(route.request().postData() ?? "{}") } }),
  );
  await page.route("**/api/observations", (route) =>
    route.fulfill({ status: 201, json: { report: JSON.parse(route.request().postData() ?? "{}") } }),
  );

  await page.goto("/plan");
  await page.getByRole("link", { name: /préparer la première séance/i }).click();
  await expect(page).toHaveURL(/\/session$/);

  await expect(page.getByText("75 min")).toBeVisible();
  await expect(page.getByText("14 joueurs")).toBeVisible();
  await expect(page.getByText("Organisation", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Ajouter 5 minutes" }).first().click();
  await expect(page.getByText("80 min")).toBeVisible();
  await page.getByRole("button", { name: "Valider cette séance" }).click();
  await expect(page.getByRole("status")).toContainText("Séance prête");
  await page.getByRole("link", { name: /observer cette séance/i }).click();

  for (const { label } of diagnosticCriteria) {
    await page.getByRole("button", { name: `${label} : En progrès` }).click();
  }

  await page.getByRole("button", { name: /valider l’observation/i }).click();
  await expect(page.getByRole("heading", { name: /garder le cap/i })).toBeVisible();
  await page.getByRole("button", { name: "Appliquer cet ajustement" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Ajustement appliqué à la prochaine séance" })).toContainText("Ajustement appliqué à la prochaine séance");
});

test("l’éducateur parcourt la bibliothèque et consulte le schéma d’un exercice", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Séances" }).click();
  await expect(page).toHaveURL(/\/bibliotheque$/);

  await page.getByRole("button", { name: "Activation" }).click();
  await page.getByRole("heading", { name: "Duel et contre-pression" }).click();
  await expect(page).toHaveURL(/\/bibliotheque\/activation-recuperer$/);

  await expect(page.getByText("But du jeu", { exact: true })).toBeVisible();
  await expect(page.getByText("Presser à deux, jamais seul.")).toBeVisible();
  await page.getByRole("button", { name: "Cet exercice m’a plu" }).click();
  await expect(page.getByRole("status")).toContainText("Merci, c’est noté.");

  await page.getByRole("link", { name: "Bibliothèque", exact: true }).click();
  await expect(page).toHaveURL(/\/bibliotheque$/);
});
