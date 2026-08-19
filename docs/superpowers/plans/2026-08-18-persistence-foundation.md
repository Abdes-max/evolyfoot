# Persistence Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure, migration-backed PostgreSQL/Prisma persistence layer for educators and their single owned team without exposing a public team API before authentication.

**Architecture:** A new server-only `@evolyfoot/database` package owns Prisma configuration, generated client, PostgreSQL adapter, mappings and repository implementations. Framework-independent services validate domain inputs and scope every team operation by `educatorId`; Next.js exposes only an information-safe database health endpoint. GitHub Actions supplies an ephemeral PostgreSQL service for migrations and integration tests.

**Tech Stack:** PostgreSQL 18.6, Prisma ORM 7.8.0, `@prisma/adapter-pg` 7.8.0, `pg`, Node.js 22.13+, TypeScript 6.0.3, Vitest, Next.js 16.3.1, pnpm/Turborepo, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-18-persistence-foundation-design.md`

## Global Constraints

- PostgreSQL 18.6 is the stable database target; PostgreSQL 19 beta is excluded.
- `prisma`, `@prisma/client` and `@prisma/adapter-pg` use exactly version 7.8.0.
- `@evolyfoot/domain` remains independent of Prisma and PostgreSQL.
- React components, Expo routes and browser bundles never import `@evolyfoot/database`, Prisma, `pg` or `DATABASE_URL`.
- Every team read/write is scoped by `educatorId`; an isolated team ID is never sufficient.
- One educator owns at most one team through a unique `educatorId` constraint.
- All team profiles pass through `createTeamProfile()` before persistence.
- No public team CRUD route, authentication placeholder, player data, external AI or managed database dependency.
- The health response reveals only `ok` or `unavailable`, never connection details or internal errors.
- No real secret or `.env` file is committed.
- Final CI must pass frozen install, generation, migrations, PostgreSQL integration tests, typecheck, lint, all existing tests/builds and Chromium E2E at the exact final SHA.

---

### Task 1: Prisma package, schema and initial migration

**Files:**
- Create: `packages/database/package.json`
- Create: `packages/database/tsconfig.json`
- Create: `packages/database/eslint.config.js`
- Create: `packages/database/vitest.config.ts`
- Create: `packages/database/prisma.config.ts`
- Create: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/20260818150000_initial_persistence/migration.sql`
- Create: `packages/database/prisma/migrations/migration_lock.toml`
- Create: `packages/database/src/email.ts`
- Create: `packages/database/src/email.test.ts`
- Create: `packages/database/src/client.ts`
- Create: `packages/database/src/client.test.ts`
- Create: `.env.example`
- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: existing `TeamProfile`, `AgeGroup` and `TrainingDay` vocabulary from `@evolyfoot/domain`.
- Produces: Prisma models `Educator` and `Team`; `normalizeEducatorEmail(email: string): string`; `createDatabaseClient(databaseUrl: string): { readonly prisma: PrismaClient; disconnect(): Promise<void> }`.

- [ ] **Step 1: Write the failing email and client contract tests**

Create `src/email.test.ts` with hand-derived literals:

```ts
import { describe, expect, it } from "vitest";
import { normalizeEducatorEmail } from "./email";

describe("normalizeEducatorEmail", () => {
  it("trims and lowercases an educator email", () => {
    expect(normalizeEducatorEmail("  Coach.Example@EVOLYFOOT.FR ")).toBe("coach.example@evolyfoot.fr");
  });

  it("rejects an empty email", () => {
    expect(() => normalizeEducatorEmail("   ")).toThrow("L’adresse e-mail de l’éducateur est obligatoire.");
  });
});
```

Create `src/client.test.ts` to protect the configuration boundary without opening a network connection:

```ts
import { describe, expect, it } from "vitest";
import { createDatabaseClient } from "./client";

describe("createDatabaseClient", () => {
  it("rejects a blank database URL before constructing an adapter", () => {
    expect(() => createDatabaseClient("   ")).toThrow("DATABASE_URL est obligatoire.");
  });
});
```

- [ ] **Step 2: Confirm RED before adding production files**

Run: `pnpm --filter @evolyfoot/database test -- src/email.test.ts src/client.test.ts`

Expected: FAIL because the package, `normalizeEducatorEmail` and `createDatabaseClient` do not exist. If the local registry blocks installation, publish the syntactically valid tests/package manifest on a temporary PR and require only these missing-module failures in GitHub Actions.

- [ ] **Step 3: Add aligned dependencies and scripts**

Use exact runtime versions for Prisma packages and resolve the latest compatible stable `pg`/types through the lockfile:

```json
{
  "name": "@evolyfoot/database",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@evolyfoot/domain": "workspace:*",
    "@prisma/adapter-pg": "7.8.0",
    "@prisma/client": "7.8.0",
    "pg": "latest"
  },
  "devDependencies": {
    "@evolyfoot/typescript-config": "workspace:*",
    "@types/pg": "latest",
    "eslint": "9.39.5",
    "prisma": "7.8.0",
    "typescript": "~6.0.3",
    "vitest": "4.1.10"
  },
  "scripts": {
    "build": "prisma generate && tsc --noEmit",
    "generate": "prisma generate",
    "lint": "eslint .",
    "typecheck": "prisma generate && tsc --noEmit",
    "test": "prisma generate && vitest run",
    "test:unit": "prisma generate && vitest run src/**/*.test.ts --exclude src/**/*.integration.test.ts",
    "test:integration": "prisma generate && vitest run src/**/*.integration.test.ts"
  }
}
```

Extend the repository's existing flat ESLint pattern in `eslint.config.js`; ignore `src/generated/prisma/**` because it is generated code. Extend the shared strict TypeScript base in `tsconfig.json` and include `src`, `prisma.config.ts` and `vitest.config.ts`.

Add root commands:

```json
"db:generate": "pnpm --filter @evolyfoot/database generate",
"db:migrate:deploy": "pnpm --filter @evolyfoot/database exec prisma migrate deploy",
"db:test:integration": "pnpm --filter @evolyfoot/database test:integration"
```

Generate `pnpm-lock.yaml` with `pnpm install --lockfile-only` using the public registry if the configured corporate registry is unavailable. Do not change existing framework pins.

- [ ] **Step 4: Define Prisma 7 configuration and schema**

Use `provider = "prisma-client"` with explicit output `../src/generated/prisma`. Define PostgreSQL enums `AgeGroup` and `TrainingDay`, mapping `MONDAY`…`FRIDAY` to the existing French values. Define:

```prisma
model Educator {
  id          String   @id @default(uuid()) @db.Uuid
  email       String   @unique
  displayName String
  team        Team?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Team {
  id              String        @id @default(uuid()) @db.Uuid
  educatorId      String        @unique @db.Uuid
  educator        Educator      @relation(fields: [educatorId], references: [id], onDelete: Cascade)
  name            String
  ageGroup        AgeGroup
  playerCount     Int
  sessionsPerWeek Int
  trainingDays    TrainingDay[]
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
}
```

Map tables and columns to snake_case in SQL. The checked-in migration must include UUID defaults, enum types, foreign key cascade, unique email and unique `educator_id`.

- [ ] **Step 5: Implement the minimal email helper and client factory**

`normalizeEducatorEmail()` trims/lowercases and throws the exact French message for an empty result. `createDatabaseClient()` rejects a blank URL, builds `PrismaPg({ connectionString })`, creates the generated `PrismaClient({ adapter })`, and returns an explicit disconnect closure. It must not read `process.env` at module import time.

- [ ] **Step 6: Verify and commit**

Run:

```bash
pnpm db:generate
pnpm --filter @evolyfoot/database test -- src/email.test.ts src/client.test.ts
pnpm --filter @evolyfoot/database typecheck
pnpm --filter @evolyfoot/database lint
git diff --check
```

Commit:

```bash
git add package.json pnpm-lock.yaml .env.example .gitignore packages/database
git commit -m "feat: add PostgreSQL persistence package"
```

### Task 2: Owned educator and team repositories

**Files:**
- Create: `packages/database/src/errors.ts`
- Create: `packages/database/src/mappers.ts`
- Create: `packages/database/src/repositories.ts`
- Create: `packages/database/src/prisma-repositories.ts`
- Create: `packages/database/src/team-profile-service.ts`
- Create: `packages/database/src/team-profile-service.test.ts`
- Create: `packages/database/src/persistence.integration.test.ts`
- Create: `packages/database/src/index.ts`

**Interfaces:**
- Consumes: Task 1 generated `PrismaClient`, `normalizeEducatorEmail`, Prisma records and `TeamProfile`.
- Produces:
  - `EducatorRecord { id, email, displayName, createdAt, updatedAt }`
  - `PersistedTeamProfile { id, educatorId, profile, createdAt, updatedAt }`
  - `EducatorRepository.create(input)` and `existsById(id)`
  - `TeamRepository.upsertForEducator(educatorId, profile)` and `findForEducator(educatorId)`
  - `TeamProfileService.save(educatorId, profile)` and `get(educatorId)`
  - `EducatorNotFoundError`, `TeamNotFoundError`, `DuplicateEducatorEmailError`.

- [ ] **Step 1: Write unit tests for service validation and ownership forwarding**

Use small in-memory fakes that implement the repository interfaces and assert consumer-visible outcomes. Cover:

```ts
await expect(service.save("educator-1", invalidProfile)).rejects.toThrow("Le profil d’équipe est incomplet.");
expect(teamRepository.writeCount).toBe(0);

await expect(service.save("missing", validProfile)).rejects.toBeInstanceOf(EducatorNotFoundError);

const saved = await service.save("educator-1", validProfile);
expect(saved.educatorId).toBe("educator-1");
expect(saved.profile.name).toBe("FC Horizon");
```

Also verify `get()` uses the caller's educator ID and throws `TeamNotFoundError` for a missing owned team.

- [ ] **Step 2: Confirm unit RED**

Run: `pnpm --filter @evolyfoot/database test -- src/team-profile-service.test.ts`

Expected: FAIL because service, repositories and errors are absent.

- [ ] **Step 3: Implement repository contracts, errors and service**

Call `createTeamProfile(profile)` before `TeamRepository.upsertForEducator`. Check `EducatorRepository.existsById()` before the write. Never accept a team ID in the service API. Freeze returned public records and clone `trainingDays`.

- [ ] **Step 4: Write PostgreSQL integration tests before Prisma implementations**

With a fresh database URL and cleanup scoped to test-created educators, cover:

- normalized unique email (`Coach@Example.fr` then ` coach@example.fr ` → `DuplicateEducatorEmailError`);
- create and idempotent update of the same educator's single team;
- two educators cannot read or overwrite each other's team;
- French day arrays and age group survive the database round-trip;
- deleting a test educator cascades its team;
- invalid profile leaves the team table unchanged.

Run: `pnpm db:migrate:deploy && pnpm --filter @evolyfoot/database test -- src/persistence.integration.test.ts`

Expected: FAIL because Prisma repository implementations are absent.

- [ ] **Step 5: Implement mappings and Prisma repositories**

Map every enum explicitly with exhaustive `switch` functions. Translate only known Prisma constraint/not-found codes into stable application errors and rethrow unexpected errors. Team queries use `where: { educatorId }`; upsert uses the unique `educatorId` key. No repository method reads by team ID alone.

- [ ] **Step 6: Verify and commit**

Run:

```bash
pnpm db:migrate:deploy
pnpm --filter @evolyfoot/database test
pnpm --filter @evolyfoot/database typecheck
pnpm --filter @evolyfoot/database lint
git diff --check
```

Commit:

```bash
git add packages/database/src
git commit -m "feat: add owned team repositories"
```

### Task 3: Information-safe database health endpoint

**Files:**
- Create: `apps/web/src/server/database-health.ts`
- Create: `apps/web/src/app/api/health/database/route.ts`
- Create: `apps/web/src/app/api/health/database/route.integration.test.ts`
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: Task 1 `createDatabaseClient()` and the server-only `DATABASE_URL`.
- Produces: `createDatabaseHealthHandler(check: () => Promise<void>, log: (error: unknown) => void): () => Promise<Response>` and `GET /api/health/database`.

- [ ] **Step 1: Write the failing route integration tests**

Test the dependency-injected handler directly:

```ts
const response = await createDatabaseHealthHandler(async () => undefined, () => undefined)();
expect(response.status).toBe(200);
expect(await response.json()).toEqual({ status: "ok" });

const failure = new Error("postgres://secret-host/internal");
const unavailable = await createDatabaseHealthHandler(async () => { throw failure; }, errors.push.bind(errors))();
expect(unavailable.status).toBe(503);
expect(await unavailable.json()).toEqual({ status: "unavailable" });
expect(await unavailable.text()).not.toContain("secret-host");
expect(errors).toEqual([failure]);
```

Read the response body only once in the actual test: serialize the parsed JSON to prove no secret appears.

- [ ] **Step 2: Confirm RED**

Run: `pnpm --filter @evolyfoot/web test -- src/app/api/health/database/route.integration.test.ts`

Expected: FAIL because the handler and route do not exist.

- [ ] **Step 3: Implement the handler and server health check**

The handler returns JSON with `content-type: application/json`, logs the original error server-side and never includes it in the response. `checkDatabaseConnection()` reads `DATABASE_URL` only when called, creates a database handle, executes `SELECT 1`, and disconnects in `finally`. `route.ts` exports `GET` wired to this check and `console.error`.

Add `@evolyfoot/database: workspace:*` only to the server-capable web package. Do not import it from any client component.

- [ ] **Step 4: Verify and commit**

Run:

```bash
pnpm --filter @evolyfoot/web test -- src/app/api/health/database/route.integration.test.ts
pnpm --filter @evolyfoot/web typecheck
pnpm --filter @evolyfoot/web lint
pnpm --filter @evolyfoot/web build
git diff --check
```

Commit:

```bash
git add apps/web/package.json apps/web/src/server apps/web/src/app/api pnpm-lock.yaml
git commit -m "feat: add database health endpoint"
```

### Task 4: PostgreSQL CI, local operations and architecture docs

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `docs/architecture.md`
- Modify: `docs/testing.md`
- Modify: `docs/delivery.md`
- Modify: `docs/roadmap.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: Tasks 1–3 generation, migration and test commands.
- Produces: repeatable PostgreSQL 18.6 CI validation and truthful local/VPS operating instructions.

- [ ] **Step 1: Add PostgreSQL to the quality job**

Add a service with an explicit health check:

```yaml
services:
  postgres:
    image: postgres:18.6
    env:
      POSTGRES_USER: evolyfoot
      POSTGRES_PASSWORD: evolyfoot_ci
      POSTGRES_DB: evolyfoot_test
    ports:
      - 5432:5432
    options: >-
      --health-cmd "pg_isready -U evolyfoot -d evolyfoot_test"
      --health-interval 5s
      --health-timeout 5s
      --health-retries 10
```

Set job-level `DATABASE_URL: postgresql://evolyfoot:evolyfoot_ci@localhost:5432/evolyfoot_test?schema=public`. After frozen install, run `pnpm db:generate` and `pnpm db:migrate:deploy` before typecheck/tests. Keep all existing jobs and checks.

- [ ] **Step 2: Document local non-destructive setup**

Document a named local container and volume, the sample `DATABASE_URL`, `pnpm db:generate`, `pnpm db:migrate:deploy` and `pnpm db:test:integration`. Keep `docker stop` separate from the explicitly destructive volume removal command and label the latter as deleting local data.

- [ ] **Step 3: Document VPS deployment order and boundaries**

State: back up → deploy image/artifact → run `prisma migrate deploy` once → start application → call `/api/health/database`. Clarify that authentication and team APIs are still absent, database backups/monitoring remain future work, and no public ports beyond the application should expose PostgreSQL.

- [ ] **Step 4: Update architecture and roadmap truthfully**

Add the database package boundary and driver-adapter decision. Split the Phase 2 roadmap item so only “Fondation PostgreSQL et Prisma” is checked; educator authentication, secured API and synchronization stay unchecked. Update the date to 18 August 2026.

- [ ] **Step 5: Run full verification and commit**

With PostgreSQL 18.6 available:

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:migrate:deploy
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
git diff --check
```

Commit:

```bash
git add .github/workflows/ci.yml README.md docs
git commit -m "ci: verify PostgreSQL persistence"
```

### Task 5: Review, publish, merge and demo handoff

**Files:**
- Review: all changes from `master` to the final branch head.
- Modify only for concrete review or CI findings.

**Interfaces:**
- Consumes: Tasks 1–4 and the existing autonomous PR authorization.
- Produces: reviewed PR, exact-head green CI, squash merge into `master`, clean feature branches/worktree, and an updated local verification guide.

- [ ] **Step 1: Run whole-branch review**

Review schema/migration equivalence, tenant ownership, Prisma error translation, connection lifecycle, secret exposure, server/client boundaries, destructive documentation, CI service health, tests and dependency alignment. Fix Critical/Important and reasonable Minor findings, then perform one scoped re-review.

- [ ] **Step 2: Publish the draft PR**

```bash
git push -u origin agent/persistence-foundation-implementation
gh pr create --draft --base master --head agent/persistence-foundation-implementation --title "Add secure PostgreSQL persistence foundation" --fill
```

- [ ] **Step 3: Require final CI and merge**

Require `Qualité et tests` and `Parcours end-to-end` to succeed at the exact final SHA. Mark ready, squash-merge into `master`, delete only the branches/worktree owned by this plan, and align local `master`.

- [ ] **Step 4: Verify handoff**

Read back the local PostgreSQL commands, health route and VPS migration order. Report clearly that educator authentication and synchronized team data remain the next tranche.
