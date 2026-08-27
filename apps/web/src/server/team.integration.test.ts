import { EducatorNotFoundError } from "@evolyfoot/database";
import type { TeamProfile } from "@evolyfoot/domain";
import { describe, expect, it } from "vitest";
import { createGetTeamHandler, createSaveTeamHandler, type TeamGateway } from "./team";

const educator = { id: "educator-1", email: "coach@example.test", displayName: "Coach" };
const validProfile: TeamProfile = {
  name: "FC Horizon",
  ageGroup: "U12",
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
    const handler = createGetTeamHandler(anonymous, { get: async () => { throw new Error("not called"); } }, () => undefined);

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
    const handler = createGetTeamHandler(authenticated, { get: async () => { throw failure; } }, errors.push.bind(errors));

    const response = await handler(new Request("https://evolyfoot.test/api/team"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("secret-host");
    expect(errors).toEqual([failure]);
  });
});

describe("createSaveTeamHandler", () => {
  it("requires an authenticated session before reading the body", async () => {
    const handler = createSaveTeamHandler(anonymous, { save: async () => { throw new Error("not called"); } }, () => undefined);

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
    const handler = createSaveTeamHandler(authenticated, { save: async () => { throw new Error("not called"); } }, () => undefined);

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
