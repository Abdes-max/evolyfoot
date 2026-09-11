import { expect, test } from "@playwright/test";
import { diagnosticCriteria } from "@evolyfoot/domain";

// L'application web est désormais protégée par deux garde-fous : apps/web/src/proxy.ts (toute
// page autre que /connexion et /inscription redirige un visiteur sans cookie de session, avant
// même que le JS client ne s'exécute -- une simple présence de cookie, valeur factice acceptée)
// et apps/web/src/app/auth-gate.tsx (un vrai fetch("/api/auth/session") côté client, qui referme
// la faille qu'un cookie sans session réelle en base laisserait ouverte). Ce deuxième garde-fou
// doit donc lui aussi être mocké ici pour que ces parcours -- qui simulent de toute façon
// l'éducateur connecté via `page.route` pour leurs propres données -- puissent atteindre leur
// contenu.
test.beforeEach(async ({ page }) => {
  await page.context().addCookies([{ name: "evolyfoot_session", value: "e2e-fake-session", url: "http://localhost:3000" }]);
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({ json: { educator: { id: "e2e-educator", email: "coach@example.test", displayName: "Coach E2E" } } }),
  );
});

test("l'éducateur accède au fil directeur de sa semaine", async ({ page }) => {
  await page.goto("/app");

  await expect(page.getByRole("heading", { name: "Bonjour Abdes," })).toBeVisible();
  await expect(page.getByText("Créer des solutions autour du porteur")).toBeVisible();
  await expect(page.getByRole("link", { name: /ouvrir la séance/i })).toBeVisible();
  await expect(page.getByText("Garde le même thème, change la contrainte.")).toBeVisible();
});

test("l’éducateur configure son équipe avant le diagnostic", async ({ page }) => {
  // La persistance réelle (session + PostgreSQL) est couverte par les tests d'intégration
  // de packages/database et apps/web/src/server ; ce parcours E2E simule un éducateur déjà
  // connecté pour vérifier le câblage client du formulaire sans dépendre d'une base de données.
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
  // "Foot à 8" apparaît aussi dans le widget saison du sidebar (SidebarIdentity) -- on cible le
  // bandeau propre à cette page pour éviter une requête ambiguë entre les deux.
  await expect(page.locator(".roster-team-summary")).toContainText("Foot à 8");

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

test("l’éducateur retrouve ses séances par créneau du cycle et ouvre celle du calendrier", async ({ page }) => {
  // Persistance réelle couverte par les tests d'intégration ; on simule ici les données de
  // l'éducateur pour vérifier le câblage client : page Séances, créneaux générés / non générés,
  // et pastille du calendrier qui ouvre la bonne séance.
  await page.route("**/api/team", (route) =>
    route.fulfill({ json: { profile: { name: "FC Horizon", ageGroup: "U12", gameFormat: 8, playerCount: 14, sessionsPerWeek: 2, trainingDays: ["Mardi", "Jeudi"] } } }),
  );
  await page.route("**/api/diagnostic", (route) => route.fulfill({ json: { scores: null } }));
  await page.route("**/api/matches", (route) => route.fulfill({ json: { matches: [] } }));
  await page.route("**/api/sessions", (route) =>
    route.fulfill({
      json: {
        sessions: [
          {
            id: "session-mardi-s1",
            title: "Séance du mardi",
            theme: "Récupérer rapidement",
            intention: "x",
            ageGroup: "U12",
            playerCount: 14,
            weekNumber: 1,
            slot: 0,
            blocks: [{ id: "b1", activityId: "welcome-recuperer", durationMinutes: 75 }],
          },
        ],
      },
    }),
  );

  await page.goto("/seances");
  await expect(page.getByRole("heading", { name: "Le cycle de quatre semaines, séance par séance." })).toBeVisible();
  await expect(page.getByRole("link", { name: /ouvrir la séance/i }).first()).toHaveAttribute("href", "/session/session-mardi-s1");
  await expect(page.getByRole("link", { name: /générer cette séance/i }).first()).toHaveAttribute("href", /\/session\?week=1&slot=1/);

  await page.goto("/app");
  await page.getByRole("link", { name: /ouvrir la séance de mardi/i }).click();
  await expect(page).toHaveURL(/\/session\/session-mardi-s1$/);
});

test("l’éducateur parcourt la bibliothèque et consulte le schéma d’un exercice", async ({ page }) => {
  // La bibliothèque d'exercices n'est plus dans le menu : on y entre depuis la page Séances.
  await page.goto("/seances");
  await page.getByRole("link", { name: /parcourir la bibliothèque/i }).click();
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

test("l’éducateur ouvre son profil, complète une information et la voit enregistrée", async ({ page }) => {
  // Persistance réelle couverte par les tests d'intégration ; ici on vérifie le câblage client de
  // la fiche profil (chargement, passage en édition, PATCH, retour en lecture).
  let stored = {
    id: "e2e-educator",
    email: "coach@example.test",
    displayName: "Coach E2E",
    birthDate: null as string | null,
    club: null as string | null,
    country: null as string | null,
    address: null as string | null,
    phone: null as string | null,
    diploma: null as string | null,
    seasonFormat: null as string | null,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  await page.route("**/api/profile", (route) => {
    if (route.request().method() === "PATCH") {
      stored = { ...stored, ...JSON.parse(route.request().postData() ?? "{}") };
      return route.fulfill({ json: { profile: stored } });
    }
    return route.fulfill({ json: { profile: stored } });
  });

  await page.goto("/app");
  await page.getByRole("link", { name: "Ouvrir mon profil" }).click();
  await expect(page).toHaveURL(/\/profil$/);
  await expect(page.getByRole("heading", { name: "Coach E2E" })).toBeVisible();

  await page.getByRole("button", { name: "Modifier" }).click();
  await page.getByLabel("Club").fill("FC Horizon");
  await page.getByRole("button", { name: "Enregistrer" }).click();

  await expect(page.getByText("Informations enregistrées.")).toBeVisible();
  await expect(page.getByText("FC Horizon")).toBeVisible();
});

test("l’éducateur ouvre la fiche d’un joueur et enregistre une évaluation datée", async ({ page }) => {
  // Persistance réelle couverte par les tests d'intégration ; on vérifie ici le câblage client :
  // liste effectif → fiche joueur → ajout d'une évaluation qui apparaît dans l'historique.
  await page.route("**/api/team", (route) =>
    route.fulfill({ json: { profile: { name: "FC Horizon", ageGroup: "U12", gameFormat: 8, playerCount: 14, sessionsPerWeek: 2, trainingDays: ["Mardi"] } } }),
  );
  await page.route("**/api/roster", (route) =>
    route.fulfill({ json: { players: [{ id: "player-1", name: "Kylian", photo: null, birthDate: null, phone: null, email: null }] } }),
  );
  const evaluations: Array<Record<string, unknown>> = [];
  await page.route("**/api/player-evaluations**", (route) => {
    const method = route.request().method();
    if (method === "POST") {
      const created = { id: `eval-${evaluations.length + 1}`, ...JSON.parse(route.request().postData() ?? "{}"), createdAt: "2026-09-10T10:00:00.000Z" };
      evaluations.unshift(created);
      return route.fulfill({ status: 201, json: { evaluation: created } });
    }
    if (method === "PATCH") {
      const id = route.request().url().split("/").pop();
      const { date, ...patch } = JSON.parse(route.request().postData() ?? "{}");
      const index = evaluations.findIndex((evaluation) => evaluation.id === id);
      evaluations[index] = { ...evaluations[index], ...patch, ...(date ? { createdAt: date } : {}) };
      return route.fulfill({ json: { evaluation: evaluations[index] } });
    }
    return route.fulfill({ json: { evaluations } });
  });

  await page.goto("/equipe");
  await page.getByRole("link", { name: "Kylian" }).click();
  await expect(page).toHaveURL(/\/equipe\/player-1$/);
  await expect(page.getByRole("heading", { name: "Kylian" })).toBeVisible();

  await page.getByRole("button", { name: "Enregistrer cette évaluation" }).click();
  await expect(page.locator(".player-count")).toHaveText("1/10");
  await expect(page.getByRole("button", { name: /retirer l’évaluation/i })).toBeVisible();

  // Modifier une évaluation existante (date + note) plutôt que d'en recréer une.
  await page.locator(".player-evaluation-history").getByRole("button", { name: "Modifier" }).click();
  await expect(page.getByRole("button", { name: "Enregistrer les modifications" })).toBeVisible();
  await page.getByLabel("Date").fill("2026-01-15");
  await page.getByRole("button", { name: "Enregistrer les modifications" }).click();
  await expect(page.locator(".player-evaluation-history").getByText("15 janvier 2026")).toBeVisible();

  // Comparer plusieurs évaluations sur le graphe : la case cochée affiche la légende associée.
  await page.locator(".player-evaluation-compare input").check();
  await expect(page.locator(".radar-chart-legend")).toBeVisible();
});

test("l’éducateur enregistre un tournoi et un plateau depuis Matchs & compétitions", async ({ page }) => {
  await page.route("**/api/team", (route) => route.fulfill({ json: { profile: { name: "FC Horizon", ageGroup: "U12", gameFormat: 8, playerCount: 14 } } }));
  await page.route("**/api/matches", (route) => route.fulfill({ json: { matches: [] } }));
  const tournaments: Array<Record<string, unknown>> = [];
  const plateaux: Array<Record<string, unknown>> = [];
  const competitionRoute = (bucket: Array<Record<string, unknown>>, key: string, listKey: string) => (route: import("@playwright/test").Route) => {
    if (route.request().method() === "POST") {
      const created = { id: `${key}-${bucket.length + 1}`, result: null, ...JSON.parse(route.request().postData() ?? "{}") };
      bucket.unshift(created);
      return route.fulfill({ status: 201, json: { [key]: created } });
    }
    return route.fulfill({ json: { [listKey]: bucket } });
  };
  await page.route("**/api/tournaments", competitionRoute(tournaments, "tournament", "tournaments"));
  await page.route("**/api/plateaux", competitionRoute(plateaux, "plateau", "plateaux"));

  await page.goto("/match");
  await expect(page.getByRole("heading", { name: "Prépare tes matchs, note tes compétitions." })).toBeVisible();

  const tournoiForm = page.locator(".competitions-panel", { hasText: "Tournois" });
  await tournoiForm.getByPlaceholder("Nom du tournoi").fill("Tournoi de printemps");
  await tournoiForm.getByPlaceholder("Date").fill("12 avril");
  await tournoiForm.getByRole("button", { name: "Ajouter" }).click();
  await expect(tournoiForm.getByText("Tournoi de printemps")).toBeVisible();

  const plateauForm = page.locator(".competitions-panel", { hasText: "Plateaux" });
  await plateauForm.getByPlaceholder("Nom du plateau").fill("Plateau de rentrée");
  await plateauForm.getByPlaceholder("Date").fill("14 septembre");
  await plateauForm.getByRole("button", { name: "Ajouter" }).click();
  await expect(plateauForm.getByText("Plateau de rentrée")).toBeVisible();
});

test("un visiteur non connecté découvre la vitrine sur la page d'accueil", async ({ page }) => {
  // La page d'accueil est publique : pas de cookie de session, pas de redirection vers /connexion.
  await page.context().clearCookies();
  // Le beforeEach simule un éducateur connecté -- on l'annule ici pour rester un vrai visiteur
  // (sinon AuthedRedirect renverrait vers /app).
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { educator: null } }));
  await page.goto("/");

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: /prépare des séances qui font progresser/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Essayer gratuitement" }).first()).toHaveAttribute("href", "/inscription");
  await expect(page.getByRole("link", { name: "Éducateurs" }).first()).toHaveAttribute("href", "/educateurs");

  // Le pied de page porte la navigation complète à toutes les tailles (le menu du header est
  // masqué sous 820px en attendant un menu mobile dédié).
  await page.locator(".m-footer").getByRole("link", { name: "Tarifs" }).click();
  await expect(page).toHaveURL(/\/tarifs$/);
  await expect(page.getByRole("heading", { name: /gratuit pour planifier/i })).toBeVisible();
});

test("le visiteur compare les fréquences de paiement Premium sur /tarifs", async ({ page }) => {
  await page.context().clearCookies();
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { educator: null, role: null } }));
  await page.goto("/tarifs");

  const premiumPrice = page.locator(".m-plan-featured .m-plan-price");

  // Sélectionné par défaut : annuel payé en une fois, le moins cher.
  await expect(premiumPrice).toContainText("4,92");

  await page.getByRole("radio", { name: "Mensuel" }).click();
  await expect(premiumPrice).toContainText("9 €");
});

test("les pages légales sont publiques et affichent leurs sections", async ({ page }) => {
  await page.context().clearCookies();
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { educator: null, role: null } }));

  await page.goto("/mentions-legales");
  await expect(page).toHaveURL(/\/mentions-legales$/);
  await expect(page.getByRole("heading", { name: "Mentions légales", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Éditeur du site" })).toBeVisible();

  await page.locator(".m-footer").getByRole("link", { name: "Confidentialité" }).click();
  await expect(page).toHaveURL(/\/confidentialite$/);
  await expect(page.getByRole("heading", { name: "Droits des personnes" })).toBeVisible();

  await page.locator(".m-footer").getByRole("link", { name: "CGU" }).click();
  await expect(page).toHaveURL(/\/cgu$/);
  await expect(page.getByRole("heading", { name: "Compte joueur / tuteur" })).toBeVisible();
});

test("l'image de partage de la vitrine se génère correctement", async ({ page }) => {
  await page.context().clearCookies();
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { educator: null, role: null } }));
  await page.goto("/");

  // L'URL exacte de l'image porte un hash généré au build (`/opengraph-image-xxxxx`) : on la lit
  // depuis la balise og:image plutôt que de la coder en dur.
  const ogImageUrl = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(ogImageUrl).toBeTruthy();

  const response = await page.request.get(ogImageUrl!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
});

test("un visiteur envoie un message depuis le formulaire de contact", async ({ page }) => {
  await page.context().clearCookies();
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { educator: null, role: null } }));

  let received: unknown = null;
  await page.route("**/api/contact", async (route) => {
    received = route.request().postDataJSON();
    await route.fulfill({ status: 201, json: { status: "ok" } });
  });

  await page.goto("/contact");
  // pressSequentially plutôt que fill : sur WebKit, un fill() sur ce champ peut se voir vidé par
  // le fill() suivant (bizarrerie connue du driver Playwright, pas un bug de l'application).
  await page.getByLabel("Ton nom").pressSequentially("Camille Éducatrice");
  await page.getByLabel("Adresse e-mail").fill("camille@example.test");
  await page.getByLabel("Ton message").fill("Une idée pour la bibliothèque d’exercices.");
  await page.getByRole("button", { name: "Envoyer le message" }).click();

  await expect(page.getByText(/message envoyé/i)).toBeVisible();
  expect(received).toEqual({
    name: "Camille Éducatrice",
    email: "camille@example.test",
    message: "Une idée pour la bibliothèque d’exercices.",
  });
});

test("les fichiers SEO restent publics (pas de redirection vers /connexion)", async ({ page }) => {
  await page.context().clearCookies();

  const sitemap = await page.request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain("<urlset");

  const robots = await page.request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Sitemap:");
});

test("le visiteur navigue dans la vitrine via le menu (mobile) ou la nav (desktop)", async ({ page, isMobile }) => {
  await page.context().clearCookies();
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { educator: null, role: null } }));
  await page.goto("/");

  if (isMobile) {
    await page.getByRole("button", { name: "Ouvrir le menu" }).click();
    await page.locator(".m-menu-panel").getByRole("link", { name: "Méthode" }).click();
  } else {
    await page.locator(".m-nav").getByRole("link", { name: "Méthode" }).click();
  }
  await expect(page).toHaveURL(/\/methode$/);
  await expect(page.getByRole("heading", { name: /une boucle claire/i })).toBeVisible();
});

test("un coach invite un tuteur, qui crée son compte et arrive sur son espace joueur", async ({ page }) => {
  // Parcours client de bout en bout, données simulées : fiche joueur → génération du lien →
  // page /rejoindre → création du compte joueur → /joueur.
  await page.route("**/api/roster", (route) =>
    route.fulfill({ json: { players: [{ id: "player-1", name: "Kylian", photo: null, birthDate: null, phone: null, email: null }] } }),
  );
  await page.route("**/api/player-evaluations**", (route) => route.fulfill({ json: { evaluations: [] } }));
  await page.route("**/api/invites", (route) =>
    route.fulfill({ status: 201, json: { url: "http://localhost:3000/rejoindre/tok-123", expiresAt: "2026-09-24T00:00:00.000Z" } }),
  );

  await page.goto("/equipe/player-1");
  await page.getByRole("button", { name: "Générer un lien d’invitation" }).click();
  await expect(page.getByLabel("Lien d’invitation")).toHaveValue(/\/rejoindre\/tok-123$/);

  // Le tuteur ouvre le lien (pas de session tant qu'il n'a pas créé son compte).
  await page.context().clearCookies();
  let registered = false;
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({ json: registered ? { educator: null, role: "player" } : { educator: null, role: null } }),
  );
  await page.route("**/api/invites/tok-123", (route) =>
    route.fulfill({ json: { invite: { playerName: "Kylian", teamName: "FC Horizon", coachName: "Coach E2E" } } }),
  );
  await page.route("**/api/auth/register-player", (route) => {
    registered = true;
    // Le cookie de session laisse le proxy autoriser /joueur ; AuthGate confirme ensuite le rôle.
    return route.fulfill({
      status: 201,
      headers: { "set-cookie": "evolyfoot_session=e2e-player-session; Path=/" },
      json: { account: { role: "player" } },
    });
  });
  await page.route("**/api/joueur", (route) =>
    route.fulfill({
      json: {
        dashboard: {
          player: { id: "player-1", name: "Kylian", photo: null },
          team: { name: "FC Horizon", ageGroup: "U12", trainingDays: ["Mardi"] },
          evaluations: [
            {
              id: "eval-2",
              scores: { technique: 8, passe: 7, vitesse: 6, physique: 7, tactique: 6, mental: 8, tir: 7 },
              createdAt: "2026-09-10T00:00:00.000Z",
            },
            {
              id: "eval-1",
              scores: { technique: 5, passe: 5, vitesse: 5, physique: 5, tactique: 5, mental: 5, tir: 5 },
              createdAt: "2026-08-01T00:00:00.000Z",
            },
          ],
          trainingAttendance: { present: 0, absent: 0, total: 0, rate: 0 },
          matchAttendance: { present: 0, absent: 0, total: 0, rate: 0 },
          upcomingMatches: [
            {
              id: "m1",
              opponent: "US Vallée",
              dateLabel: "Samedi 19 septembre",
              meetingTime: "14:30",
              location: "Stade Marius Requier, Aix-en-Provence",
              description: "Brassage journée 1 (triangulaire)",
              venue: "home",
              convoked: true,
              myStatus: null,
            },
          ],
          trainingSlots: [],
          trainingSessions: [
            {
              id: "s1",
              title: "Conserver le ballon",
              dateLabel: "Mardi 15 septembre",
              meetingTime: "18:00",
              location: "Stade Marius Requier, Aix-en-Provence",
              description: "Prévoir crampons moulés, terrain synthétique.",
              myStatus: null,
            },
          ],
          competitions: [{ id: "p1", type: "plateau", name: "Plateau de rentrée", dateLabel: "Dimanche 20 septembre" }],
        },
      },
    }),
  );
  let rsvp: { matchId: string; status: string; comment?: string | null } | null = null;
  await page.route("**/api/joueur/rsvp", (route) => {
    rsvp = JSON.parse(route.request().postData() ?? "{}");
    return route.fulfill({ json: { status: "ok" } });
  });
  let sessionRsvp: { sessionId: string; status: string; comment?: string | null } | null = null;
  await page.route("**/api/joueur/rsvp-seance", (route) => {
    sessionRsvp = JSON.parse(route.request().postData() ?? "{}");
    return route.fulfill({ json: { status: "ok" } });
  });

  await page.goto("/rejoindre/tok-123");
  await expect(page.getByRole("heading", { name: /suis la progression de kylian/i })).toBeVisible();
  await page.getByLabel("Ton nom").fill("Parent de Kylian");
  await page.getByLabel("Adresse e-mail").fill("parent@example.test");
  await page.getByLabel(/mot de passe/i).fill("un-mot-de-passe");
  await page.getByRole("button", { name: /créer mon accès/i }).click();

  await expect(page).toHaveURL(/\/joueur$/);
  await expect(page.getByRole("heading", { name: "Kylian" })).toBeVisible();

  // Barre de navigation fixe à 3 onglets (Mon enfant / Calendrier / Messages).
  const tabBar = page.locator(".player-tab-bar");
  await expect(tabBar.getByRole("link", { name: "Mon enfant" })).toHaveClass(/active/);

  // Onglet Calendrier : calendrier de la semaine, convocations et compétitions.
  await tabBar.getByRole("link", { name: "Calendrier" }).click();
  await expect(page).toHaveURL(/\/joueur\/calendrier$/);
  await expect(page.getByRole("heading", { name: "Calendrier de la semaine" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Compétitions" })).toBeVisible();
  await expect(page.getByText("Plateau de rentrée")).toBeVisible();
  await expect(page.getByText("US Vallée")).toBeVisible();
  // Badge de réponse orange tant que le tuteur n'a pas répondu -- une pour la séance, une pour le
  // match, toutes deux "en attente" au départ.
  await expect(page.getByText("En attente de réponse")).toHaveCount(2);

  // "Mes séances" : même page de détail, icônes + plan de l'adresse, réponse binaire -- toujours
  // "convoquée" (pas de composition retenue pour une séance, toute l'équipe est attendue).
  await page.locator(".player-space-matches").getByRole("link", { name: /Conserver le ballon/ }).click();
  await expect(page).toHaveURL(/\/joueur\/seances\/s1$/);
  await expect(page.locator(".player-match-detail")).toContainText("Conserver le ballon");
  await expect(page.locator(".player-match-detail")).toContainText("Stade Marius Requier, Aix-en-Provence");
  await expect(page.locator(".player-match-detail")).toContainText("18:00");
  await expect(page.locator(".map-embed iframe")).toBeVisible();
  await expect(page.locator(".player-tab-bar")).toHaveCount(0);
  await page.getByRole("button", { name: "Absent" }).click();
  await page.getByLabel("Motif").selectOption("injured");
  await page.getByLabel(/commentaire/i).fill("Cheville qui tire");
  await page.getByRole("button", { name: "Confirmer" }).click();
  await expect.poll(() => sessionRsvp).toEqual({ sessionId: "s1", status: "injured", comment: "Cheville qui tire" });
  await page.getByRole("link", { name: "← Retour" }).click();
  await expect(page).toHaveURL(/\/joueur\/calendrier$/);

  // Réponse du joueur/tuteur à la convocation depuis "Mes convocations" : ouvre une vraie page
  // (/joueur/matches/:id), pas un panneau superposé -- et sans barre de navigation (page de
  // détail, comme match-prep-view.tsx côté coach).
  await page.locator(".player-space-matches").getByRole("link", { name: /US Vallée/ }).click();
  await expect(page).toHaveURL(/\/joueur\/matches\/m1$/);
  await expect(page.locator(".player-match-detail")).toContainText("US Vallée");
  await expect(page.locator(".player-match-detail")).toContainText("Stade Marius Requier, Aix-en-Provence");
  await expect(page.locator(".player-match-detail")).toContainText("14:30");
  await expect(page.locator(".player-tab-bar")).toHaveCount(0);
  // Réponse binaire : "Absent" ouvre une popup pour préciser le motif et un commentaire à
  // destination du coach.
  await page.getByRole("button", { name: "Absent" }).click();
  await page.getByLabel("Motif").selectOption("sick");
  await page.getByLabel(/commentaire/i).fill("Fièvre depuis hier soir");
  await page.getByRole("button", { name: "Confirmer" }).click();
  await expect.poll(() => rsvp).toEqual({ matchId: "m1", status: "sick", comment: "Fièvre depuis hier soir" });
  await page.getByRole("link", { name: "← Retour" }).click();
  await expect(page).toHaveURL(/\/joueur$/);

  // Cliquer sur l'événement du calendrier ouvre la même page de détail.
  await tabBar.getByRole("link", { name: "Calendrier" }).click();
  await page.getByRole("link", { name: "Voir le détail du match contre US Vallée" }).click();
  await expect(page).toHaveURL(/\/joueur\/matches\/m1$/);
  await expect(page.locator(".player-match-detail")).toContainText("US Vallée");
  await page.getByRole("button", { name: "Présent" }).click();
  await expect.poll(() => rsvp).toEqual({ matchId: "m1", status: "present", comment: null });
  await page.getByRole("link", { name: "← Retour" }).click();

  // Onglet Messages : placeholder honnête, pas encore de messagerie.
  await page.locator(".player-tab-bar").getByRole("link", { name: "Messages" }).click();
  await expect(page).toHaveURL(/\/joueur\/messages$/);
  await expect(page.getByText(/messagerie avec l.éducateur arrive bientôt/i)).toBeVisible();

  // Retour à l'onglet Mon enfant pour comparer plusieurs évaluations sur le radar, en lecture
  // seule (pas de bouton ajouter/modifier/retirer côté joueur/tuteur).
  await page.locator(".player-tab-bar").getByRole("link", { name: "Mon enfant" }).click();
  await expect(page).toHaveURL(/\/joueur$/);
  await expect(page.getByRole("heading", { name: "Ma progression" })).toBeVisible();
  await expect(page.getByRole("button", { name: /modifier|retirer/i })).toHaveCount(0);
  await page.locator(".player-space-history .player-evaluation-compare input").last().check();
  await expect(page.locator(".radar-chart-legend")).toBeVisible();
});
