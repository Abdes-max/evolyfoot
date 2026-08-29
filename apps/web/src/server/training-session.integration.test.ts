import { EducatorNotFoundError } from "@evolyfoot/database";
import { describe, expect, it } from "vitest";
import {
  createSaveTrainingSessionHandler,
  type PersistedTrainingSession,
  type TrainingSessionGateway,
  type TrainingSessionInput,
} from "./training-session";

const educator = { id: "educator-1", email: "coach@example.test", displayName: "Coach" };

const validInput: TrainingSessionInput = {
  title: "Accueil du groupe",
  ageGroup: "U12",
  playerCount: 14,
  theme: "Récupérer rapidement",
  intention: "Provoquer des pertes de balle pour s’entraîner à réagir vite.",
  blocks: [{ id: "b1", activityId: "activite-1", durationMinutes: 75 }],
};

const persisted: PersistedTrainingSession = { ...validInput, id: "session-1", createdAt: "2026-08-29T12:00:00.000Z" };

function jsonRequest(body: unknown): Request {
  return new Request("https://evolyfoot.test/api/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const authenticated = async () => educator;
const anonymous = async () => null;

describe("createSaveTrainingSessionHandler", () => {
  it("requires an authenticated session before reading the body", async () => {
    const handler = createSaveTrainingSessionHandler(
      anonymous,
      { save: async () => { throw new Error("not called"); } },
      () => undefined,
    );

    const response = await handler(jsonRequest(validInput));

    expect(response.status).toBe(401);
  });

  it("never trusts an educatorId supplied in the request body", async () => {
    const receivedIds: string[] = [];
    const gateway: Pick<TrainingSessionGateway, "save"> = {
      save: async (educatorId) => {
        receivedIds.push(educatorId);
        return persisted;
      },
    };
    const handler = createSaveTrainingSessionHandler(authenticated, gateway, () => undefined);

    await handler(jsonRequest({ ...validInput, educatorId: "attacker-supplied-id" }));

    expect(receivedIds).toEqual([educator.id]);
  });

  it("rejects a malformed body without calling the gateway", async () => {
    const handler = createSaveTrainingSessionHandler(
      authenticated,
      { save: async () => { throw new Error("not called"); } },
      () => undefined,
    );

    const response = await handler(jsonRequest({ ...validInput, blocks: [] }));

    expect(response.status).toBe(400);
  });

  it("rejects an unknown age group without calling the gateway", async () => {
    const handler = createSaveTrainingSessionHandler(
      authenticated,
      { save: async () => { throw new Error("not called"); } },
      () => undefined,
    );

    const response = await handler(jsonRequest({ ...validInput, ageGroup: "U9" }));

    expect(response.status).toBe(400);
  });

  it("maps a domain validation failure to a 400 with its message", async () => {
    const gateway: Pick<TrainingSessionGateway, "save"> = {
      save: async () => {
        throw new Error("La séance doit durer entre 60 et 90 minutes.");
      },
    };
    const handler = createSaveTrainingSessionHandler(authenticated, gateway, () => undefined);

    const response = await handler(jsonRequest(validInput));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("La séance doit durer entre 60 et 90 minutes.");
  });

  it("maps a missing educator to a 401", async () => {
    const gateway: Pick<TrainingSessionGateway, "save"> = {
      save: async () => {
        throw new EducatorNotFoundError();
      },
    };
    const handler = createSaveTrainingSessionHandler(authenticated, gateway, () => undefined);

    const response = await handler(jsonRequest(validInput));

    expect(response.status).toBe(401);
  });

  it("saves and returns the session on success", async () => {
    const handler = createSaveTrainingSessionHandler(
      authenticated,
      { save: async (_id, input) => ({ ...input, id: "session-1", createdAt: "2026-08-29T12:00:00.000Z" }) },
      () => undefined,
    );

    const response = await handler(jsonRequest(validInput));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ session: persisted });
  });
});
