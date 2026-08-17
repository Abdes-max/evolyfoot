# Session Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Générer une séance de 75 minutes liée au cycle et permettre au coach d’en modifier la durée, l’ordre et les situations sur web et mobile.

**Architecture:** Le package `@evolyfoot/domain` expose un catalogue local et des fonctions pures de génération et d’édition. Les pages Expo et Next.js maintiennent une copie locale de la séance et délèguent toutes les règles au domaine.

**Tech Stack:** TypeScript 6.0.3, React 19, Next.js 16.3.1, Expo SDK 57, React Native 0.86.2, Vitest 4.1.10, Testing Library et Playwright.

## Global Constraints

- La séance contient exactement quatre blocs : accueil, mise en action, situation principale et jeu final.
- La proposition initiale dure exactement 75 minutes.
- Un bloc dure au minimum 5 minutes et les ajustements se font par pas de 5 minutes.
- La validation est autorisée uniquement pour une durée totale comprise entre 60 et 90 minutes.
- Le catalogue et les règles restent sans dépendance d’interface ni de persistance.
- Le comportement web et mobile utilise le même modèle métier.

---

### Task 1: Modèle métier et génération déterministe

**Files:**
- Create: `packages/domain/src/training-session.test.ts`
- Create: `packages/domain/src/training-session.ts`
- Modify: `packages/domain/src/index.ts`

**Interfaces:**
- Consumes: `DevelopmentWeek`, `AgeGroup` et `DevelopmentTheme` depuis `@evolyfoot/domain`.
- Produces: `TrainingActivity`, `TrainingBlock`, `TrainingSession`, `generateTrainingSession(week, ageGroup, playerCount)` et `getSessionDuration(session)`.

- [ ] **Step 1: Write the failing generation test**

```ts
it("génère quatre blocs totalisant 75 minutes", () => {
  const session = generateTrainingSession(developmentWeek, "U12", 14);
  expect(session.blocks.map((block) => block.kind)).toEqual([
    "welcome", "activation", "main", "game",
  ]);
  expect(getSessionDuration(session)).toBe(75);
  expect(generateTrainingSession(developmentWeek, "U12", 14)).toEqual(session);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm --filter @evolyfoot/domain test -- training-session.test.ts`

Expected: FAIL because `training-session.ts` and its exports do not exist.

- [ ] **Step 3: Implement the minimal catalogue and generator**

Define these exact types and signatures:

```ts
export type TrainingBlockKind = "welcome" | "activation" | "main" | "game";
export interface TrainingActivity {
  id: string;
  kind: TrainingBlockKind;
  title: string;
  compatibleThemes: DevelopmentTheme[];
  objective: string;
  organization: string;
  instruction: string;
  observable: string;
}
export interface TrainingBlock { activity: TrainingActivity; durationMinutes: number; }
export interface TrainingSession {
  id: string;
  title: string;
  ageGroup: AgeGroup;
  playerCount: number;
  theme: DevelopmentTheme;
  intention: string;
  blocks: TrainingBlock[];
}
export function generateTrainingSession(
  week: DevelopmentWeek,
  ageGroup: AgeGroup,
  playerCount: number,
): TrainingSession;
export function getSessionDuration(session: TrainingSession): number;
```

Use fixed block durations `[10, 15, 25, 25]`. Select the first catalogue activity matching both `kind` and `week.theme`; catalogue ordering makes generation deterministic.

- [ ] **Step 4: Run the domain tests and verify GREEN**

Run: `pnpm --filter @evolyfoot/domain test`

Expected: all domain tests pass, including the new 75-minute assertion.

- [ ] **Step 5: Commit the domain generator**

```bash
git add packages/domain/src/training-session.ts packages/domain/src/training-session.test.ts packages/domain/src/index.ts
git commit -m "Add training session generator"
```

### Task 2: Opérations d’édition sûres

**Files:**
- Modify: `packages/domain/src/training-session.test.ts`
- Modify: `packages/domain/src/training-session.ts`

**Interfaces:**
- Consumes: `TrainingSession` et le catalogue de Task 1.
- Produces: `adjustBlockDuration(session, index, delta)`, `moveSessionBlock(session, from, to)`, `replaceSessionActivity(session, index)` et `canValidateSession(session)`.

- [ ] **Step 1: Write failing editing tests**

```ts
it("édite une séance sans muter la proposition", () => {
  const longer = adjustBlockDuration(session, 0, 5);
  expect(getSessionDuration(longer)).toBe(80);
  expect(getSessionDuration(session)).toBe(75);
  expect(adjustBlockDuration(session, 0, -10).blocks[0].durationMinutes).toBe(5);
  expect(adjustBlockDuration(session, 0, -15).blocks[0].durationMinutes).toBe(5);
});

it("réordonne et remplace avec une activité compatible", () => {
  expect(moveSessionBlock(session, 0, 1).blocks[1].activity.kind).toBe("welcome");
  expect(moveSessionBlock(session, 0, -1)).toEqual(session);
  const replacement = replaceSessionActivity(session, 2);
  expect(replacement.blocks[2].activity.id).not.toBe(session.blocks[2].activity.id);
  expect(replacement.blocks[2].activity.compatibleThemes).toContain(session.theme);
});

it("valide uniquement une durée totale entre 60 et 90 minutes", () => {
  expect(canValidateSession(session)).toBe(true);
  expect(canValidateSession(adjustBlockDuration(session, 2, 20))).toBe(false);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `pnpm --filter @evolyfoot/domain test -- training-session.test.ts`

Expected: FAIL because the four editing functions are not exported.

- [ ] **Step 3: Implement immutable editing functions**

Clone only the `blocks` array and the changed block. Clamp durations with `Math.max(5, current + delta)`. Ignore moves whose indexes are outside `0..3`. Replacement selects the next compatible catalogue entry of the same kind, wrapping once; if none exists, return the original session. `canValidateSession` returns `duration >= 60 && duration <= 90`.

- [ ] **Step 4: Run all domain tests and verify GREEN**

Run: `pnpm --filter @evolyfoot/domain test`

Expected: all tests pass with no warnings.

- [ ] **Step 5: Commit editing operations**

```bash
git add packages/domain/src/training-session.ts packages/domain/src/training-session.test.ts
git commit -m "Add safe session editing"
```

### Task 3: Constructeur web accessible

**Files:**
- Create: `apps/web/src/app/session/page.tsx`
- Create: `apps/web/src/app/session/session-builder.tsx`
- Create: `apps/web/src/app/session/page.integration.test.tsx`
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/app/plan/page.tsx`

**Interfaces:**
- Consumes: the Task 1 and Task 2 domain API.
- Produces: route `/session` and client component `SessionBuilder({ initialSession })`.

- [ ] **Step 1: Write the failing integration test**

```tsx
it("recalcule la durée et valide une séance modifiée", () => {
  render(<SessionPage />);
  expect(screen.getByText("75 min")).toBeVisible();
  fireEvent.click(screen.getAllByRole("button", { name: "Ajouter 5 minutes" })[0]);
  expect(screen.getByText("80 min")).toBeVisible();
  fireEvent.click(screen.getAllByRole("button", { name: "Remplacer la situation" })[2]);
  fireEvent.click(screen.getByRole("button", { name: "Valider cette séance" }));
  expect(screen.getByRole("status")).toHaveTextContent("Séance prête");
});
```

- [ ] **Step 2: Run the web test and verify RED**

Run: `pnpm --filter @evolyfoot/web test -- src/app/session/page.integration.test.tsx`

Expected: FAIL because route `/session` does not exist.

- [ ] **Step 3: Implement the page and builder**

`page.tsx` generates the demo session from week 1 of the current development plan. `session-builder.tsx` owns `useState(initialSession)`, calls only domain editing functions and renders four cards. Each card has accessible buttons named `Retirer 5 minutes`, `Ajouter 5 minutes`, `Monter`, `Descendre` and `Remplacer la situation`. Disable validation when `canValidateSession` is false and show `La séance doit durer entre 60 et 90 minutes.`

Replace the plan page’s `Adopter ce cycle` button with a Next.js `Link` to `/session` labeled `Préparer la première séance`.

- [ ] **Step 4: Run web tests and verify GREEN**

Run: `pnpm --filter @evolyfoot/web test`

Expected: all web integration tests pass.

- [ ] **Step 5: Commit the web builder**

```bash
git add apps/web/src/app/session apps/web/src/app/globals.css apps/web/src/app/plan/page.tsx
git commit -m "Add web session builder"
```

### Task 4: Parcours mobile et validation E2E

**Files:**
- Create: `apps/mobile/app/session.tsx`
- Modify: `apps/mobile/app/plan.tsx`
- Modify: `e2e/dashboard.spec.ts`
- Modify: `docs/roadmap.md`

**Interfaces:**
- Consumes: the shared session API and Expo Router.
- Produces: mobile route `/session`, complete web E2E path and documented Phase 1 progress.

- [ ] **Step 1: Write the failing E2E test**

```ts
test("le coach personnalise puis valide sa séance", async ({ page }) => {
  await page.goto("/session");
  await expect(page.getByText("75 min")).toBeVisible();
  await page.getByRole("button", { name: "Ajouter 5 minutes" }).first().click();
  await expect(page.getByText("80 min")).toBeVisible();
  await page.getByRole("button", { name: "Valider cette séance" }).click();
  await expect(page.getByRole("status")).toContainText("Séance prête");
});
```

- [ ] **Step 2: Run E2E and verify RED**

Run: `pnpm exec playwright test e2e/dashboard.spec.ts --project=chromium --grep "personnalise"`

Expected: FAIL before the session route from Task 3 is present in the execution baseline.

- [ ] **Step 3: Implement the mobile route**

Generate the same initial session in `apps/mobile/app/session.tsx`. Render four vertical cards and use `TouchableOpacity` controls for ±5 minutes, moving and replacing. Display the duration warning and disable the final action using `canValidateSession`. Add an Expo Router `Link` from `apps/mobile/app/plan.tsx` to `/session` labeled `Préparer la première séance`.

- [ ] **Step 4: Update progress documentation**

Mark `Constructeur de séance` complete in `docs/roadmap.md` and state that generation, duration, order and replacement are covered by unit, integration and E2E tests.

- [ ] **Step 5: Run the full verification suite**

Run:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

Expected: every command exits 0; Playwright validates dashboard, onboarding, diagnostic, plan and session builder.

- [ ] **Step 6: Commit the completed cross-platform flow**

```bash
git add apps/mobile/app/session.tsx apps/mobile/app/plan.tsx e2e/dashboard.spec.ts docs/roadmap.md
git commit -m "Complete session builder flow"
```

### Task 5: Publish and validate the PR

**Files:**
- No production files unless CI exposes a reproducible defect.

**Interfaces:**
- Consumes: all prior commits.
- Produces: draft PR into `master` with green GitHub Actions checks.

- [ ] **Step 1: Push the feature branch**

Run: `git push -u origin agent/session-builder-spec`

- [ ] **Step 2: Open the draft PR**

Run: `gh pr create --draft --base master --head agent/session-builder-spec --title "Add guided session builder" --fill`

- [ ] **Step 3: Watch CI**

Run: `gh pr checks --watch --interval 10`

Expected: `Qualité et tests` and `Parcours end-to-end` both pass.

- [ ] **Step 4: Keep merge user-gated**

Report the PR URL, exact checks and mergeability. Do not mark ready or merge until the user explicitly approves.
