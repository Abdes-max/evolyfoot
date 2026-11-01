import { EducatorNotFoundError, ValidationError } from "@evolyfoot/database";
import { createEmptyPlayerEvaluationScores } from "@evolyfoot/domain";
import { describe, expect, it, vi } from "vitest";
import type { PublicAccount } from "./auth";
import { createAddSelfEvaluationHandler } from "./player-dashboard";

const account = { id: "player-account" } as PublicAccount;
const scores = createEmptyPlayerEvaluationScores();
const evaluation = { id: "self-1", scores, source: "player" as const, createdAt: new Date("2026-11-01T00:00:00.000Z") };

function post(body: unknown): Request {
  return new Request("http://localhost/api/joueur/auto-evaluation", { method: "POST", body: JSON.stringify(body) });
}

describe("createAddSelfEvaluationHandler", () => {
  it("refuse une requête sans compte joueur", async () => {
    const handler = createAddSelfEvaluationHandler(async () => null, { addSelfEvaluation: vi.fn() }, vi.fn());

    expect((await handler(post({ scores }))).status).toBe(401);
  });

  it("refuse une auto-évaluation incomplète", async () => {
    const addSelfEvaluation = vi.fn();
    const handler = createAddSelfEvaluationHandler(async () => account, { addSelfEvaluation }, vi.fn());

    expect((await handler(post({ scores: { technique: 5 } }))).status).toBe(400);
    expect(addSelfEvaluation).not.toHaveBeenCalled();
  });

  it("enregistre pour le joueur du compte connecté", async () => {
    const addSelfEvaluation = vi.fn(async () => evaluation);
    const handler = createAddSelfEvaluationHandler(async () => account, { addSelfEvaluation }, vi.fn());

    const response = await handler(post({ scores, playerId: "autre-joueur" }));

    expect(response.status).toBe(201);
    expect(addSelfEvaluation).toHaveBeenCalledWith("player-account", scores);
  });

  it("traduit les erreurs métier", async () => {
    const capped = createAddSelfEvaluationHandler(
      async () => account,
      { addSelfEvaluation: async () => { throw new ValidationError("Limite atteinte."); } },
      vi.fn(),
    );
    const unlinked = createAddSelfEvaluationHandler(
      async () => account,
      { addSelfEvaluation: async () => { throw new EducatorNotFoundError(); } },
      vi.fn(),
    );

    expect((await capped(post({ scores }))).status).toBe(400);
    expect((await unlinked(post({ scores }))).status).toBe(404);
  });
});
