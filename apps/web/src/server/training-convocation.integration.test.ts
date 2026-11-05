import { TeamNotFoundError, ValidationError } from "@evolyfoot/database";
import { describe, expect, it } from "vitest";
import type { PublicEducator } from "./auth";
import { createGetConvocationSettingsHandler, createSaveConvocationSettingsHandler } from "./training-convocation";

const educator = { id: "coach-1", displayName: "Coach" } as PublicEducator;
const put = (body: unknown) => new Request("http://localhost/api/team/convocations", { method: "PUT", body: JSON.stringify(body) });

describe("réglage des convocations aux entraînements", () => {
  it("demande une session", async () => {
    const handler = createGetConvocationSettingsHandler(
      async () => null,
      { getSettings: async () => ({ leadDays: null, attendanceDefault: null }) },
      () => undefined,
    );
    expect((await handler(new Request("http://localhost/api/team/convocations"))).status).toBe(401);
  });

  it("renvoie le réglage de l'éducateur", async () => {
    const handler = createGetConvocationSettingsHandler(
      async () => educator,
      { getSettings: async () => ({ leadDays: 2, attendanceDefault: "present" }) },
      () => undefined,
    );
    expect(await (await handler(new Request("http://localhost/api/team/convocations"))).json()).toEqual({
      settings: { leadDays: 2, attendanceDefault: "present" },
    });
  });

  it("enregistre, refuse un réglage invalide et une équipe absente", async () => {
    const ok = createSaveConvocationSettingsHandler(
      async () => educator,
      { saveSettings: async (_id, input) => ({ leadDays: input.leadDays as number, attendanceDefault: "ask" }) },
      () => undefined,
    );
    expect((await ok(put({ leadDays: 1, attendanceDefault: "ask" }))).status).toBe(200);
    const invalid = createSaveConvocationSettingsHandler(
      async () => educator,
      { saveSettings: async () => Promise.reject(new ValidationError("Non")) },
      () => undefined,
    );
    expect((await invalid(put({ leadDays: 5 }))).status).toBe(400);
    const noTeam = createSaveConvocationSettingsHandler(
      async () => educator,
      { saveSettings: async () => Promise.reject(new TeamNotFoundError()) },
      () => undefined,
    );
    expect((await noTeam(put({ leadDays: 1, attendanceDefault: "ask" }))).status).toBe(404);
  });
});
