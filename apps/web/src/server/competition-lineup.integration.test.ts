import { ValidationError } from "@evolyfoot/database";
import { describe, expect, it, vi } from "vitest";
import type { PublicEducator } from "./auth";
import { createSaveCompetitionLineupHandler } from "./competition-lineup";

const educator = { id: "coach-1" } as PublicEducator;
const put = (body: unknown) => new Request("https://evolyfoot.test/api/plateaux/p-1/lineup", { method: "PUT", body: JSON.stringify(body) });

describe("composition d'un tournoi ou d'un plateau", () => {
  it("exige une session puis enregistre la composition", async () => {
    const lineup = { gameFormat: 5 as const, formationId: "x", lineup: [], captainPlayerId: null, substitutePlayerIds: [] };
    const gateway = { save: vi.fn(async () => lineup) };
    expect(
      (
        await createSaveCompetitionLineupHandler(
          "plateau",
          async () => null,
          gateway,
          () => undefined,
        )(put({ lineup }), "p-1")
      ).status,
    ).toBe(401);
    const response = await createSaveCompetitionLineupHandler(
      "plateau",
      async () => educator,
      gateway,
      () => undefined,
    )(put({ lineup }), "p-1");
    expect(response.status).toBe(200);
    expect(gateway.save).toHaveBeenCalledWith("coach-1", "plateau", "p-1", lineup);
  });

  it("renvoie 400 pour une composition incohérente", async () => {
    const gateway = {
      save: vi.fn(async () => {
        throw new ValidationError("Poste inconnu dans la composition.");
      }),
    };
    const response = await createSaveCompetitionLineupHandler(
      "tournament",
      async () => educator,
      gateway,
      () => undefined,
    )(put({ lineup: {} }), "t-1");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Poste inconnu dans la composition." });
  });
});
