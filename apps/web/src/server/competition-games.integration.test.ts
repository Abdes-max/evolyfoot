import { PlateauNotFoundError, ValidationError } from "@evolyfoot/database";
import { describe, expect, it } from "vitest";
import { createSaveCompetitionGamesHandler } from "./competition-games";

const educator = { id: "educator-1", email: "coach@example.test", displayName: "Coach" };
const authenticated = async () => educator;

function put(body: unknown): Request {
  return new Request("https://evolyfoot.test/api/tournaments/t-1/games", { method: "PUT", body: typeof body === "string" ? body : JSON.stringify(body) });
}

describe("createSaveCompetitionGamesHandler", () => {
  it("exige une session", async () => {
    const handler = createSaveCompetitionGamesHandler(
      "tournament",
      async () => null,
      { save: async () => [] },
      () => undefined,
    );
    expect((await handler(put({ games: [] }), "t-1")).status).toBe(401);
  });

  it("transmet le type, l'identifiant et les rencontres, et renvoie la liste enregistrée", async () => {
    const received: unknown[] = [];
    const handler = createSaveCompetitionGamesHandler(
      "plateau",
      authenticated,
      {
        save: async (...args) => {
          received.push(args);
          return [];
        },
      },
      () => undefined,
    );
    const games = [{ id: "g1" }];

    const response = await handler(put({ games }), "p-1");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ games: [] });
    expect(received).toEqual([["educator-1", "plateau", "p-1", games]]);
  });

  it("répond 400 pour une validation, 404 pour une fiche inconnue, 500 sinon", async () => {
    const failing = (error: unknown) =>
      createSaveCompetitionGamesHandler("tournament", authenticated, { save: async () => Promise.reject(error) }, () => undefined);
    expect((await failing(new ValidationError("Rencontres invalides."))(put({ games: 1 }), "t-1")).status).toBe(400);
    expect((await failing(new PlateauNotFoundError())(put({ games: [] }), "t-1")).status).toBe(404);
    expect((await failing(new Error("boom"))(put({ games: [] }), "t-1")).status).toBe(500);
    expect((await failing(new Error("boom"))(put("pas du json"), "t-1")).status).toBe(500);
  });
});
