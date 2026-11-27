import { EducatorNotFoundError, TeamNotFoundError, ValidationError } from "@evolyfoot/database";
import type { TeamProfile } from "@evolyfoot/domain";
import { describe, expect, it } from "vitest";
import { createGetTeamHandler, createSaveTeamCalendarFeedHandler, createSaveTeamHandler, createSaveTeamLogoHandler, type TeamGateway } from "./team";

const educator = { id: "educator-1", email: "coach@example.test", displayName: "Coach" };
const validProfile: TeamProfile = {
  name: "FC Horizon",
  ageGroup: "U12",
  gameFormat: 8,
  playerCount: 14,
  sessionsPerWeek: 2,
  trainingDays: ["Mardi", "Jeudi"],
};

function jsonRequest(body: unknown): Request {
  return new Request("https://evolyfoot.test/api/team", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const authenticated = async () => educator;
const anonymous = async () => null;

describe("createGetTeamHandler", () => {
  it("requires an authenticated session", async () => {
    const handler = createGetTeamHandler(
      anonymous,
      {
        get: async () => {
          throw new Error("not called");
        },
      },
      () => undefined,
    );

    const response = await handler(new Request("https://evolyfoot.test/api/team"));

    expect(response.status).toBe(401);
  });

  it("returns the educator's team profile", async () => {
    const handler = createGetTeamHandler(authenticated, { get: async () => validProfile }, () => undefined);

    const response = await handler(new Request("https://evolyfoot.test/api/team"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ profile: validProfile });
  });

  it("returns a null profile when the educator has none yet", async () => {
    const handler = createGetTeamHandler(authenticated, { get: async () => null }, () => undefined);

    const response = await handler(new Request("https://evolyfoot.test/api/team"));

    expect(await response.json()).toEqual({ profile: null });
  });

  it("logs and returns an information-safe 500 for an unexpected error", async () => {
    const errors: unknown[] = [];
    const failure = new Error("postgres://secret-host/internal");
    const handler = createGetTeamHandler(
      authenticated,
      {
        get: async () => {
          throw failure;
        },
      },
      errors.push.bind(errors),
    );

    const response = await handler(new Request("https://evolyfoot.test/api/team"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("secret-host");
    expect(errors).toEqual([failure]);
  });
});

describe("createSaveTeamHandler", () => {
  it("requires an authenticated session before reading the body", async () => {
    const handler = createSaveTeamHandler(
      anonymous,
      {
        save: async () => {
          throw new Error("not called");
        },
      },
      () => undefined,
    );

    const response = await handler(jsonRequest(validProfile));

    expect(response.status).toBe(401);
  });

  it("never trusts an educatorId supplied in the request body", async () => {
    const receivedIds: string[] = [];
    const gateway: Pick<TeamGateway, "save"> = {
      save: async (educatorId) => {
        receivedIds.push(educatorId);
        return validProfile;
      },
    };
    const handler = createSaveTeamHandler(authenticated, gateway, () => undefined);

    await handler(jsonRequest({ ...validProfile, educatorId: "attacker-supplied-id" }));

    expect(receivedIds).toEqual([educator.id]);
  });

  it("rejects a malformed body without calling the gateway", async () => {
    const handler = createSaveTeamHandler(
      authenticated,
      {
        save: async () => {
          throw new Error("not called");
        },
      },
      () => undefined,
    );

    const response = await handler(jsonRequest({ name: "FC Horizon" }));

    expect(response.status).toBe(400);
  });

  it("maps a domain validation failure to a 400 with its message", async () => {
    const gateway: Pick<TeamGateway, "save"> = {
      save: async () => {
        throw new Error("Le profil d’équipe est incomplet.");
      },
    };
    const handler = createSaveTeamHandler(authenticated, gateway, () => undefined);

    const response = await handler(jsonRequest(validProfile));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Le profil d’équipe est incomplet.");
  });

  it("maps a missing educator to a 401", async () => {
    const gateway: Pick<TeamGateway, "save"> = {
      save: async () => {
        throw new EducatorNotFoundError();
      },
    };
    const handler = createSaveTeamHandler(authenticated, gateway, () => undefined);

    const response = await handler(jsonRequest(validProfile));

    expect(response.status).toBe(401);
  });

  it("saves and returns the profile on success", async () => {
    const handler = createSaveTeamHandler(authenticated, { save: async (_id, profile) => profile }, () => undefined);

    const response = await handler(jsonRequest(validProfile));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ profile: validProfile });
  });
});

describe("createSaveTeamLogoHandler", () => {
  const logo = "data:image/png;base64,iVBORw0KGgo=";

  it("exige une session et un logo (texte ou null)", async () => {
    const unused = { saveLogo: async () => validProfile };
    expect((await createSaveTeamLogoHandler(anonymous, unused, () => undefined)(jsonRequest({ logo }))).status).toBe(401);
    expect((await createSaveTeamLogoHandler(authenticated, unused, () => undefined)(jsonRequest({}))).status).toBe(400);
    expect((await createSaveTeamLogoHandler(authenticated, unused, () => undefined)(jsonRequest({ logo: 3 }))).status).toBe(400);
  });

  it("transmet le logo, ou null pour le retirer, et renvoie le profil", async () => {
    const received: unknown[] = [];
    const handler = createSaveTeamLogoHandler(
      authenticated,
      {
        saveLogo: async (id, value) => {
          received.push([id, value]);
          return { ...validProfile, logo: value };
        },
      },
      () => undefined,
    );

    const response = await handler(jsonRequest({ logo }));
    expect(response.status).toBe(200);
    expect((await response.json()).profile.logo).toBe(logo);
    await handler(jsonRequest({ logo: null }));
    expect(received).toEqual([
      ["educator-1", logo],
      ["educator-1", null],
    ]);
  });

  it("répond 400 pour une image invalide, 404 sans équipe, 500 sinon", async () => {
    const failing = (error: unknown) => createSaveTeamLogoHandler(authenticated, { saveLogo: async () => Promise.reject(error) }, () => undefined);
    expect((await failing(new ValidationError("Le logo doit être une image."))(jsonRequest({ logo: "x" }))).status).toBe(400);
    expect((await failing(new TeamNotFoundError())(jsonRequest({ logo }))).status).toBe(404);
    expect((await failing(new Error("boom"))(jsonRequest({ logo }))).status).toBe(500);
  });
});

describe("createSaveTeamCalendarFeedHandler", () => {
  const calendarFeedUrl = "https://media.fff.fr/calendars/2026/eq/1625_FA_6.ics";

  it("exige une session et un lien (texte ou null)", async () => {
    const unused = { saveCalendarFeedUrl: async () => validProfile };
    expect((await createSaveTeamCalendarFeedHandler(anonymous, unused, () => undefined)(jsonRequest({ calendarFeedUrl }))).status).toBe(401);
    expect((await createSaveTeamCalendarFeedHandler(authenticated, unused, () => undefined)(jsonRequest({}))).status).toBe(400);
    expect((await createSaveTeamCalendarFeedHandler(authenticated, unused, () => undefined)(jsonRequest({ calendarFeedUrl: 3 }))).status).toBe(400);
  });

  it("transmet le lien, ou null pour le retirer, et renvoie le profil", async () => {
    const received: unknown[] = [];
    const handler = createSaveTeamCalendarFeedHandler(
      authenticated,
      {
        saveCalendarFeedUrl: async (id, value) => {
          received.push([id, value]);
          return { ...validProfile, calendarFeedUrl: value };
        },
      },
      () => undefined,
    );

    const response = await handler(jsonRequest({ calendarFeedUrl }));
    expect(response.status).toBe(200);
    expect((await response.json()).profile.calendarFeedUrl).toBe(calendarFeedUrl);
    await handler(jsonRequest({ calendarFeedUrl: null }));
    expect(received).toEqual([
      ["educator-1", calendarFeedUrl],
      ["educator-1", null],
    ]);
  });

  it("répond 400 pour un lien invalide, 404 sans équipe, 500 sinon", async () => {
    const failing = (error: unknown) =>
      createSaveTeamCalendarFeedHandler(authenticated, { saveCalendarFeedUrl: async () => Promise.reject(error) }, () => undefined);
    expect((await failing(new ValidationError("Indique un lien valide."))(jsonRequest({ calendarFeedUrl: "x" }))).status).toBe(400);
    expect((await failing(new TeamNotFoundError())(jsonRequest({ calendarFeedUrl }))).status).toBe(404);
    expect((await failing(new Error("boom"))(jsonRequest({ calendarFeedUrl }))).status).toBe(500);
  });
});
