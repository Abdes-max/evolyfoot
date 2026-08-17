import { expect, test } from "@playwright/test";

test("l'éducateur accède au fil directeur de sa semaine", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Bonjour Abdes," })).toBeVisible();
  await expect(page.getByText("Créer des solutions autour du porteur")).toBeVisible();
  await expect(page.getByRole("button", { name: /ouvrir la séance/i })).toBeVisible();
  await expect(page.getByText("Garde le même thème, change la contrainte.")).toBeVisible();
});

test("l’éducateur configure son équipe avant le diagnostic", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByLabel("Nom de l’équipe").fill("FC Horizon");
  await page.getByRole("button", { name: "Mar" }).click();
  await page.getByRole("button", { name: "Jeu" }).click();
  await page.getByRole("button", { name: /valider mon équipe/i }).click();
  await expect(page.getByRole("status")).toContainText("Équipe prête");
});

test("le diagnostic révèle deux priorités de développement", async ({ page }) => {
  await page.goto("/diagnostic");
  await page.getByRole("button", { name: "Réagir après la perte : Rarement" }).click();
  await page.getByRole("button", { name: "Voir mes priorités" }).click();
  await expect(page.getByRole("status")).toContainText("Récupérer rapidement");
});

test("le plan organise la progression sur quatre semaines",async({page})=>{await page.goto("/plan");await expect(page.getByRole("heading",{name:"Ton premier cycle est prêt."})).toBeVisible();await expect(page.getByText("S4",{exact:true})).toBeVisible();await expect(page.getByRole("button",{name:/adopter ce cycle/i})).toBeVisible();});
