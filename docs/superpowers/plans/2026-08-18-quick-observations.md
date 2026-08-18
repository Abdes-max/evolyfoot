# Quick Observations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shared, accessible observation flow for training sessions and matches that produces an explainable summary in under three minutes.

**Architecture:** Pure observation types and transitions live in `@evolyfoot/domain`. Next.js and Expo Router own only temporary UI state and render the same four criteria, optional player signals and computed summary. Data remains local and serializable until the persistence phase.

**Tech Stack:** TypeScript 6.0.3, React 19, Next.js 16 App Router, Expo SDK 57, React Native 0.86, Vitest, Testing Library, Playwright, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-18-quick-observations-design.md`

## Global Constraints

- The same report format must support `training` and `match` events.
- All four collective criteria are required; player signals and notes are optional.
- UI copy is French and avoids judgmental language.
- Mobile interactive targets remain at least 44 × 44 pixels.
- No database, API, authentication or new runtime dependency is added.
- Every implementation task follows red-green-refactor and ends in a focused commit.
- CI must validate frozen install, typecheck, lint, unit/integration tests, web build, Expo Android bundle and Chromium E2E.

---

### Task 1: Observation domain model

**Files:**
- Create: `packages/domain/src/observation.ts`
- Create: `packages/domain/src/observation.test.ts`
- Modify: `packages/domain/src/index.ts`

**Interfaces:**
- Consumes: `DiagnosticCriterion` and `diagnosticCriteria` from `packages/domain/src/diagnostic.ts`.
- Produces: `ObservationEventType`, `ObservationLevel`, `ObservationDraft`, `ObservationReport`, `PlayerSignal`, `createObservationDraft()`, `rateObservation()`, `togglePlayerSignal()`, `setObservationNote()`, `canCompleteObservation()` and `completeObservation()`.

- [ ] **Step 1: Write failing domain tests**

```ts
const draft = createObservationDraft("training", "Séance 1", players);
expect(canCompleteObservation(draft)).toBe(false);

const rated = diagnosticCriteria.reduce(
  (current, criterion) => rateObservation(current, criterion.id, "progress"),
  draft,
);
expect(canCompleteObservation(rated)).toBe(true);
expect(completeObservation(rated).summary.averageScore).toBe(50);
```

Also assert 0/50/100 normalization, toggling the same player signal off, replacing a player's opposite signal, ignoring unknown players/criteria, trimming blank notes and preserving input immutability.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `pnpm --filter @evolyfoot/domain test -- src/observation.test.ts`

Expected: FAIL because `observation.ts` and its exports do not exist.

- [ ] **Step 3: Implement the pure model**

```ts
export type ObservationEventType = "training" | "match";
export type ObservationLevel = "reinforce" | "progress" | "achieved";
export type PlayerSignalKind = "highlight" | "support";

export interface PlayerReference { id: string; name: string }
export interface PlayerSignal { playerId: string; playerName: string; kind: PlayerSignalKind }
export interface ObservationRating { criterion: DiagnosticCriterion; level: ObservationLevel }
```

Use a constant score map `{ reinforce: 0, progress: 50, achieved: 100 }`. `completeObservation()` must throw `Error("Les quatre comportements doivent être renseignés.")` for an incomplete draft, strip blank notes and derive strongest/weakest criteria with stable diagnostic order for ties.

- [ ] **Step 4: Export and verify GREEN**

Run: `pnpm --filter @evolyfoot/domain test -- src/observation.test.ts && pnpm --filter @evolyfoot/domain typecheck`

Expected: all observation tests and typecheck pass.

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/observation.ts packages/domain/src/observation.test.ts packages/domain/src/index.ts
git commit -m "feat: add quick observation domain"
```

### Task 2: Accessible web observation flow

**Files:**
- Create: `apps/web/src/app/observation/page.tsx`
- Create: `apps/web/src/app/observation/observation-form.tsx`
- Create: `apps/web/src/app/observation/page.integration.test.tsx`
- Create: `apps/web/src/app/observation.css`
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/app/session/session-builder.tsx`
- Modify: `apps/web/src/app/page.tsx`

**Interfaces:**
- Consumes: the complete Task 1 public observation API.
- Produces: route `/observation`, accessible `ObservationForm`, a post-validation session link, and a dashboard match entry.

- [ ] **Step 1: Write the failing integration test**

```tsx
render(<ObservationPage />);
fireEvent.click(screen.getByRole("button", { name: "Après un match" }));
for (const label of diagnosticCriteria.map((criterion) => criterion.label)) {
  fireEvent.click(screen.getByRole("button", { name: `${label} : En progrès` }));
}
fireEvent.click(screen.getByRole("button", { name: /mettre Lina en réussite à retenir/i }));
fireEvent.click(screen.getByRole("button", { name: /valider l’observation/i }));
expect(screen.getByRole("status")).toHaveTextContent("Tendance en progrès");
expect(screen.getByRole("status")).toHaveTextContent("1 joueur signalé");
```

Also assert the submit button is disabled initially, buttons expose `aria-pressed`, and a repeated player action removes the signal.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `pnpm --filter @evolyfoot/web test -- src/app/observation/page.integration.test.tsx`

Expected: FAIL because the observation route does not exist.

- [ ] **Step 3: Implement the page and client form**

Use a local demo roster with stable IDs. Render event type controls, four criterion cards, three level buttons per card, optional player signal controls and a 280-character textarea. Keep all transitions in the domain functions. After completion, render one `role="status"` summary with trend, strongest behavior, weakest behavior and player count.

The session builder shows `Observer cette séance` only after its local validation succeeds. The dashboard exposes `Observer un match` linking to `/observation?type=match`; the page reads the initial type from `searchParams` and still lets the coach switch it.

- [ ] **Step 4: Add focused responsive styles**

Use existing colors and spacing, visible focus states, text plus color for selections, a two-column desktop layout collapsing to one column, and no horizontal overflow at 320 px.

- [ ] **Step 5: Verify web GREEN**

Run: `pnpm --filter @evolyfoot/web test -- src/app/observation/page.integration.test.tsx && pnpm --filter @evolyfoot/web typecheck && pnpm --filter @evolyfoot/web lint`

Expected: integration test, typecheck and lint pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/observation apps/web/src/app/observation.css apps/web/src/app/layout.tsx apps/web/src/app/session/session-builder.tsx apps/web/src/app/page.tsx
git commit -m "feat: add web observation flow"
```

### Task 3: Mobile flow, E2E and roadmap

**Files:**
- Create: `apps/mobile/app/observation.tsx`
- Modify: `apps/mobile/app/session.tsx`
- Modify: `apps/mobile/app/index.tsx`
- Modify: `e2e/dashboard.spec.ts`
- Modify: `docs/roadmap.md`
- Modify: `docs/testing.md`

**Interfaces:**
- Consumes: Task 1 observation API and Task 2 user-visible copy.
- Produces: Expo route `/observation`, complete browser E2E, updated progress and demonstration instructions.

- [ ] **Step 1: Extend E2E and confirm RED**

```ts
await page.getByRole("button", { name: /valider cette séance/i }).click();
await page.getByRole("link", { name: /observer cette séance/i }).click();
for (const label of ["Se rendre disponible", "Regarder avant de recevoir", "Progresser vers la cible", "Réagir après la perte"]) {
  await page.getByRole("button", { name: `${label} : En progrès` }).click();
}
await page.getByRole("button", { name: /valider l’observation/i }).click();
await expect(page.getByRole("status")).toContainText("Tendance en progrès");
```

Run: `pnpm test:e2e`

Expected: FAIL before the observation route and session link exist in the execution baseline.

- [ ] **Step 2: Implement the Expo route**

Use `SafeAreaView`, `ScrollView`, `TouchableOpacity`, `TextInput` and the shared domain transitions. Set `accessibilityRole="button"`, `accessibilityState={{ selected }}`, `accessibilityLiveRegion="polite"`, `minHeight: 44`, `minWidth: 44` and `hitSlop` on compact actions. Match the web content hierarchy and show the same final summary.

- [ ] **Step 3: Link mobile entry points**

After session validation, show an Expo Router link `Observer cette séance`. Add a dashboard action `Observer un match` leading to `/observation?type=match`.

- [ ] **Step 4: Document completion and demo**

Mark “Observation rapide après séance et match” complete in `docs/roadmap.md`. Add a short `Démonstration locale` section to `docs/testing.md` with the web commands and the exact route sequence `/onboarding` → `/diagnostic` → `/plan` → `/session` → `/observation`.

- [ ] **Step 5: Run full verification**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e`

Expected: all commands exit 0, including the Expo Android export invoked by the mobile build script.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/observation.tsx apps/mobile/app/session.tsx apps/mobile/app/index.tsx e2e/dashboard.spec.ts docs/roadmap.md docs/testing.md
git commit -m "feat: complete quick observation flow"
```

### Task 4: Review, publish and merge

**Files:**
- Review: all files changed since `master`
- Modify only when review or CI identifies a concrete defect.

**Interfaces:**
- Consumes: Tasks 1–3 and repository delivery policy.
- Produces: reviewed GitHub PR into `master`, green CI, merged squash commit and cleaned feature branch.

- [ ] **Step 1: Run final local checks**

Run: `git diff --check && pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e`

Expected: clean diff and all checks pass. If the local registry remains unavailable, record that constraint and require every GitHub Actions job to succeed at the exact head SHA.

- [ ] **Step 2: Request whole-branch review**

Review `master...HEAD` for spec compliance, logic, accessibility, regressions, security and missing tests. Resolve all Critical and Important findings and reasonable Minor findings, then re-review only the fixes.

- [ ] **Step 3: Push and open a draft PR**

```bash
git push -u origin agent/quick-observations
gh pr create --draft --base master --head agent/quick-observations --title "Add quick session and match observations" --fill
```

- [ ] **Step 4: Validate CI, merge and clean up**

Require `Qualité et tests` and `Parcours end-to-end` to succeed at the final SHA. Mark the PR ready, squash-merge it into `master`, delete the remote branch, align local `master`, remove the owned worktree if one was used, and delete only the merged local feature branch.
