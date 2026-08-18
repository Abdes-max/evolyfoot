# Explainable Adjustments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a completed observation report into one transparent, coach-controlled adjustment for the next session.

**Architecture:** A pure rule engine in `@evolyfoot/domain` consumes the immutable observation report and current development week. Web and mobile render the same suggestion and keep accept/decline/undo state locally. No persistence, external AI or new runtime dependency is introduced.

**Tech Stack:** TypeScript 6.0.3, React 19, Next.js 16 App Router, Expo SDK 57, React Native 0.86, Vitest, Testing Library, Playwright, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-18-explainable-adjustments-design.md`

## Global Constraints

- Return exactly one of `reinforce`, `progress` or `maintain`.
- Every explanation cites an observed collective score and never names an individual player.
- Only one training constraint changes in a suggestion.
- The suggestion and its inputs remain immutable and JSON-serializable.
- Web and mobile expose Apply, Keep plan and reversible local confirmation states.
- Mobile interactive targets remain at least 44 × 44 pixels with iOS and Android announcements.
- No database, API, authentication, external AI or new runtime dependency.
- CI must pass frozen install, typecheck, lint, unit/integration tests, web build, Expo Android bundle and Chromium E2E at the final SHA.

---

### Task 1: Shared adjustment rule engine

**Files:**
- Create: `packages/domain/src/adjustment.ts`
- Create: `packages/domain/src/adjustment.test.ts`
- Modify: `packages/domain/src/index.ts`

**Interfaces:**
- Consumes: `ObservationReport`, `DevelopmentWeek`, `diagnosticCriteria` and existing `DevelopmentTheme`.
- Produces: `AdjustmentAction`, `AdjustmentSuggestion`, `suggestAdjustmentFromObservation(report, currentWeek)`.

- [ ] **Step 1: Write failing tests for the public contract**

```ts
const suggestion = suggestAdjustmentFromObservation(reportWith({ reactionAfterLoss: 0 }), currentWeek);
expect(suggestion.action).toBe("reinforce");
expect(suggestion.reason).toContain("Réagir après la perte");
expect(suggestion.reason).toContain("0/100");
expect(suggestion.proposedTheme).toBe("Récupérer rapidement");
```

Add separate tests for average exactly 75 without zero → `progress`, middle scores → `maintain`, stable weakest tie, both event types, malformed report error, deep input immutability, frozen suggestion and JSON round-trip.

- [ ] **Step 2: Confirm RED**

Run: `pnpm --filter @evolyfoot/domain test -- src/adjustment.test.ts`

Expected: FAIL because the adjustment module and exports are absent.

- [ ] **Step 3: Implement the minimal deterministic engine**

```ts
export type AdjustmentAction = "reinforce" | "progress" | "maintain";

export interface AdjustmentSuggestion {
  readonly id: string;
  readonly action: AdjustmentAction;
  readonly title: string;
  readonly reason: string;
  readonly triggerScore: number;
  readonly proposedTheme: DevelopmentTheme;
  readonly constraint: string;
  readonly observable: string;
  readonly impact: string;
}
```

Validate that the report has all four unique canonical criteria and only scores 0/50/100. Select the weakest in diagnostic order. Apply the spec thresholds and return a deeply frozen plain object whose ID derives from the report ID.

- [ ] **Step 4: Confirm GREEN and commit**

Run: `pnpm --filter @evolyfoot/domain test -- src/adjustment.test.ts && pnpm --filter @evolyfoot/domain typecheck`

```bash
git add packages/domain/src/adjustment.ts packages/domain/src/adjustment.test.ts packages/domain/src/index.ts
git commit -m "feat: add explainable adjustment engine"
```

### Task 2: Web suggestion and coach decision

**Files:**
- Create: `apps/web/src/app/observation/adjustment-card.tsx`
- Create: `apps/web/src/app/observation/adjustment-card.integration.test.tsx`
- Modify: `apps/web/src/app/observation/observation-form.tsx`
- Modify: `apps/web/src/app/observation.css`

**Interfaces:**
- Consumes: Task 1 engine and the `ObservationReport` already created by the form.
- Produces: accessible `AdjustmentCard({ suggestion })` with local `pending | accepted | declined` state and undo/reconsider actions.

- [ ] **Step 1: Write the failing integration test**

```tsx
render(<AdjustmentCard suggestion={suggestion} />);
expect(screen.getByText(/0\/100/)).toBeVisible();
fireEvent.click(screen.getByRole("button", { name: "Appliquer cet ajustement" }));
expect(screen.getByRole("status")).toHaveTextContent("Ajustement appliqué à la prochaine séance");
fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
expect(screen.getByRole("button", { name: "Garder mon plan" })).toBeEnabled();
```

Also cover decline and reconsider, visible Why/Change/Observe sections, no player name and stable focus after a decision.

- [ ] **Step 2: Confirm RED**

Run: `pnpm --filter @evolyfoot/web test -- src/app/observation/adjustment-card.integration.test.tsx`

Expected: FAIL because `AdjustmentCard` does not exist.

- [ ] **Step 3: Implement and integrate**

Create the suggestion only after `completeObservation(draft)` succeeds. Render it below the observation summary. Keep decision state inside the card; use a polite live region and return focus to the primary action when undoing or reconsidering. Display explicit `Pourquoi`, `Ce qui change`, `À observer` headings.

- [ ] **Step 4: Verify and commit**

Run: `pnpm --filter @evolyfoot/web test -- src/app/observation && pnpm --filter @evolyfoot/web typecheck && pnpm --filter @evolyfoot/web lint`

```bash
git add apps/web/src/app/observation
git commit -m "feat: add web adjustment decision"
```

### Task 3: Mobile suggestion, E2E and demo documentation

**Files:**
- Create: `apps/mobile/components/adjustment-card.tsx`
- Modify: `apps/mobile/app/observation.tsx`
- Modify: `e2e/dashboard.spec.ts`
- Modify: `docs/roadmap.md`
- Modify: `docs/testing.md`

**Interfaces:**
- Consumes: Task 1 engine and Task 2 copy hierarchy.
- Produces: native adjustment card, full E2E application path, completed Phase 1 roadmap and two-scenario demo guide.

- [ ] **Step 1: Extend E2E and confirm RED**

```ts
await page.getByRole("button", { name: /valider l’observation/i }).click();
await expect(page.getByRole("heading", { name: /garder le cap/i })).toBeVisible();
await page.getByRole("button", { name: "Appliquer cet ajustement" }).click();
await expect(page.getByRole("status")).toContainText("Ajustement appliqué à la prochaine séance");
```

Expected: FAIL before the suggestion card exists.

- [ ] **Step 2: Implement the mobile card**

Mirror the web hierarchy and local states using `TouchableOpacity`. Set minimum height 44, `accessibilityRole`, disabled/selected state where relevant, `accessibilityLiveRegion="polite"` for Android and `AccessibilityInfo.announceForAccessibility()` for iOS decisions.

- [ ] **Step 3: Complete roadmap and demo guide**

Mark “Ajustement explicable proposé par Evoly” complete. Extend the local demo with a maintain scenario (four “En progrès”) and a reinforce scenario (“Réagir après la perte” at 0/100), plus the clear local-only persistence disclaimer.

- [ ] **Step 4: Run full verification and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e`

```bash
git add apps/mobile apps/web e2e/dashboard.spec.ts docs/roadmap.md docs/testing.md
git commit -m "feat: complete explainable adjustment flow"
```

### Task 4: Review, publish, merge and prepare demo

**Files:**
- Review: all changes from `master` to the final branch head.
- Modify only for concrete review or CI findings.

**Interfaces:**
- Consumes: Tasks 1–3 and the autonomous PR authorization.
- Produces: reviewed PR, exact-head green CI, squash merge into `master`, cleaned branches/worktrees and a ready-to-run demo guide.

- [ ] **Step 1: Run whole-branch review**

Review spec compliance, rule thresholds, invalid data, accessibility, focus, cross-platform parity, security, tests and documentation. Fix Critical/Important and reasonable Minor findings, then perform one scoped re-review.

- [ ] **Step 2: Publish the PR**

```bash
git push -u origin agent/explainable-adjustments-implementation
gh pr create --draft --base master --head agent/explainable-adjustments-implementation --title "Add explainable coaching adjustments" --fill
```

- [ ] **Step 3: Require final CI and merge**

Require `Qualité et tests` and `Parcours end-to-end` to succeed at the exact final SHA. Mark ready, squash-merge into `master`, delete only feature branches/worktrees, and align local `master`.

- [ ] **Step 4: Verify demo readiness**

Read back `docs/testing.md`, verify the route sequence and commands, and report the exact demonstration path without claiming server persistence.
