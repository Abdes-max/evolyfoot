import { EducatorNotFoundError, ValidationError } from "@evolyfoot/database";
import { describe, expect, it } from "vitest";
import {
  createGetTrainingSessionHandler,
  createListTrainingSessionsHandler,
  createPrepareSeasonSessionHandler,
  createSaveTrainingSessionHandler,
  createUpdateTrainingSessionDetailsHandler,
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
  weekNumber: 1,
  slot: 0,
  meetingAt: "2026-09-15T18:00:00.000Z",
};

const persisted: PersistedTrainingSession = {
  ...validInput,
  id: "session-1",
  location: null,
  description: null,
  cycleNumber: 1,
  createdAt: "2026-08-29T12:00:00.000Z",
};

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
      {
        save: async () => {
          throw new Error("not called");
        },
      },
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
      {
        save: async () => {
          throw new Error("not called");
        },
      },
      () => undefined,
    );

    const response = await handler(jsonRequest({ ...validInput, blocks: [] }));

    expect(response.status).toBe(400);
  });

  it("rejects an unknown age group without calling the gateway", async () => {
    const handler = createSaveTrainingSessionHandler(
      authenticated,
      {
        save: async () => {
          throw new Error("not called");
        },
      },
      () => undefined,
    );

    const response = await handler(jsonRequest({ ...validInput, ageGroup: "U9" }));

    expect(response.status).toBe(400);
  });

  it("rejects a cycle week outside 1..4 without calling the gateway", async () => {
    const handler = createSaveTrainingSessionHandler(
      authenticated,
      {
        save: async () => {
          throw new Error("not called");
        },
      },
      () => undefined,
    );

    expect((await handler(jsonRequest({ ...validInput, weekNumber: 9 }))).status).toBe(400);
    expect((await handler(jsonRequest({ ...validInput, slot: -1 }))).status).toBe(400);
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
      { save: async (_id, input) => ({ ...input, id: "session-1", location: null, description: null, cycleNumber: 1, createdAt: "2026-08-29T12:00:00.000Z" }) },
      () => undefined,
    );

    const response = await handler(jsonRequest(validInput));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ session: persisted });
  });
});

describe("createListTrainingSessionsHandler", () => {
  it("requires an authenticated session", async () => {
    const handler = createListTrainingSessionsHandler(anonymous, { list: async () => [], currentCycle: async () => 1 });
    expect((await handler(jsonRequest(validInput))).status).toBe(401);
  });

  it("returns the educator's saved sessions", async () => {
    const handler = createListTrainingSessionsHandler(authenticated, { list: async () => [persisted], currentCycle: async () => 1 });
    const response = await handler(jsonRequest(validInput));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sessions: [persisted], cycleNumber: 1 });
  });
});

describe("createGetTrainingSessionHandler", () => {
  it("requires an authenticated session", async () => {
    const handler = createGetTrainingSessionHandler(anonymous, { getById: async () => null });
    expect((await handler(jsonRequest(validInput), "session-1")).status).toBe(401);
  });

  it("maps an unknown id to a 404", async () => {
    const handler = createGetTrainingSessionHandler(authenticated, { getById: async () => null });
    expect((await handler(jsonRequest(validInput), "missing")).status).toBe(404);
  });

  it("returns the session when found", async () => {
    const handler = createGetTrainingSessionHandler(authenticated, { getById: async () => persisted });
    const response = await handler(jsonRequest(validInput), "session-1");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ session: persisted });
  });
});

describe("createUpdateTrainingSessionDetailsHandler", () => {
  it("requires authentication", async () => {
    const handler = createUpdateTrainingSessionDetailsHandler(
      anonymous,
      {
        updateDetails: async () => {
          throw new Error("not called");
        },
      },
      () => undefined,
    );
    expect((await handler(jsonRequest({ location: "Stade X" }), "session-1")).status).toBe(401);
  });

  it("forwards only the provided fields, leaving the rest untouched", async () => {
    const received: unknown[] = [];
    const gateway: Pick<TrainingSessionGateway, "updateDetails"> = {
      updateDetails: async (educatorId, id, input) => {
        received.push({ educatorId, id, input });
        return persisted;
      },
    };
    const handler = createUpdateTrainingSessionDetailsHandler(authenticated, gateway, () => undefined);

    const response = await handler(jsonRequest({ location: "Stade Marius Requier" }), "session-1");

    expect(response.status).toBe(200);
    expect(received).toEqual([
      { educatorId: educator.id, id: "session-1", input: { meetingAt: undefined, location: "Stade Marius Requier", description: undefined } },
    ]);
  });

  it("accepts null to clear a field", async () => {
    const received: unknown[] = [];
    const gateway: Pick<TrainingSessionGateway, "updateDetails"> = {
      updateDetails: async (_educatorId, _id, input) => {
        received.push(input);
        return persisted;
      },
    };
    const handler = createUpdateTrainingSessionDetailsHandler(authenticated, gateway, () => undefined);

    await handler(jsonRequest({ location: null }), "session-1");

    expect(received).toEqual([{ meetingAt: undefined, location: null, description: undefined }]);
  });
});

describe("createPrepareSeasonSessionHandler", () => {
  const prepareInput = {
    sessionNumber: 3,
    seasonWeek: 9,
    slot: 0,
    ageGroup: "U11",
    playerCount: 16,
    meetingAt: "2026-11-04T17:00:00.000Z",
    location: "Stade municipal",
  };

  it("prépare la séance de la saison avec son lieu", async () => {
    const received: unknown[] = [];
    const handler = createPrepareSeasonSessionHandler(
      authenticated,
      {
        prepareFromSeason: async (_id, input) => {
          received.push(input);
          return { ...persisted, cycleNumber: 0, weekNumber: 9, location: input.location };
        },
      },
      () => undefined,
    );

    const response = await handler(jsonRequest(prepareInput));

    expect(response.status).toBe(201);
    expect((await response.json()).session.location).toBe("Stade municipal");
    expect(received).toEqual([prepareInput]);
  });

  it("refuse une séance sans lieu ou sans date", async () => {
    const handler = createPrepareSeasonSessionHandler(
      authenticated,
      {
        prepareFromSeason: async () => {
          throw new ValidationError("Indique le lieu de la séance.");
        },
      },
      () => undefined,
    );

    expect((await handler(jsonRequest({ ...prepareInput, meetingAt: "pas une date" }))).status).toBe(400);
    expect((await handler(jsonRequest({ ...prepareInput, location: undefined }))).status).toBe(400);
    const empty = await handler(jsonRequest({ ...prepareInput, location: "" }));
    expect(empty.status).toBe(400);
    expect(await empty.json()).toEqual({ error: "Indique le lieu de la séance." });
  });
});
