import { describe, expect, it } from "vitest";
import { createGetSeasonProgramHandler, createSaveSeasonProgramHandler } from "./season-program";

const educator = { id: "educator-1", email: "coach@example.test", displayName: "Coach" };
const authenticated = async () => educator;
const anonymous = async () => null;
const program = { priorities: ["Finir les actions" as const], startDate: "2026-11-02" };

function putRequest(body: unknown): Request {
  return new Request("https://evolyfoot.test/api/season-program", { method: "PUT", body: JSON.stringify(body) });
}

describe("saison guidée : API", () => {
  it("demande une session et renvoie la saison, ou null s’il n’y en a pas", async () => {
    const request = new Request("https://evolyfoot.test/api/season-program");
    expect((await createGetSeasonProgramHandler(anonymous, { get: async () => program }, () => undefined)(request)).status).toBe(401);

    const response = await createGetSeasonProgramHandler(authenticated, { get: async () => null }, () => undefined)(request);
    expect(await response.json()).toEqual({ program: null });
  });

  it("enregistre les priorités et renvoie l’erreur de validation au coach", async () => {
    const received: unknown[] = [];
    const handler = createSaveSeasonProgramHandler(
      authenticated,
      {
        save: async (_educatorId, priorities) => {
          received.push(priorities);
          if (!Array.isArray(priorities) || priorities.length === 0) throw new Error("Choisis un ou deux thèmes prioritaires.");
          return program;
        },
      },
      () => undefined,
    );

    const saved = await handler(putRequest({ priorities: ["Finir les actions"] }));
    expect(saved.status).toBe(200);
    expect(await saved.json()).toEqual({ program });

    const invalid = await handler(putRequest({ priorities: [] }));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: "Choisis un ou deux thèmes prioritaires." });
    expect(received).toEqual([["Finir les actions"], []]);
  });
});
