import { EducatorNotFoundError, ObservationNotFoundError } from "@evolyfoot/database";
import { diagnosticCriteria, type ObservationDraft, type ObservationReport } from "@evolyfoot/domain";
import { describe, expect, it } from "vitest";
import {
  createGetObservationHandler,
  createListObservationsHandler,
  createSaveObservationHandler,
  type ObservationGateway,
  type ObservationRecord,
} from "./observation";

const educator = { id: "educator-1", email: "coach@example.test", displayName: "Coach" };

const completeDraft: ObservationDraft = {
  id: "observation-1",
  eventType: "training",
  title: "Observation de séance",
  dateLabel: "29 août 2026",
  players: [{ id: "lina", name: "Lina" }],
  ratings: diagnosticCriteria.map((criterion) => ({ criterion: criterion.id, level: "progress" as const })),
  signals: [],
};

const report: ObservationReport = {
  ...completeDraft,
  ratings: completeDraft.ratings.map((rating) => ({ ...rating, score: 50 })),
  summary: {
    averageScore: 50,
    trend: "progress",
    strongest: { criterion: completeDraft.ratings[0].criterion, level: "progress", score: 50, label: "Disponibilité" },
    weakest: { criterion: completeDraft.ratings[0].criterion, level: "progress", score: 50, label: "Disponibilité" },
  },
};

function jsonRequest(body: unknown): Request {
  return new Request("https://evolyfoot.test/api/observations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const record: ObservationRecord = { ...report, createdAt: "2026-08-29T12:00:00.000Z" };

function getRequest(): Request {
  return new Request("https://evolyfoot.test/api/observations");
}

const authenticated = async () => educator;
const anonymous = async () => null;

describe("createSaveObservationHandler", () => {
  it("requires an authenticated session before reading the body", async () => {
    const handler = createSaveObservationHandler(
      anonymous,
      { save: async () => { throw new Error("not called"); } },
      () => undefined,
    );

    const response = await handler(jsonRequest(completeDraft));

    expect(response.status).toBe(401);
  });

  it("never trusts an educatorId supplied in the request body", async () => {
    const receivedIds: string[] = [];
    const gateway: Pick<ObservationGateway, "save"> = {
      save: async (educatorId) => {
        receivedIds.push(educatorId);
        return report;
      },
    };
    const handler = createSaveObservationHandler(authenticated, gateway, () => undefined);

    await handler(jsonRequest({ ...completeDraft, educatorId: "attacker-supplied-id" }));

    expect(receivedIds).toEqual([educator.id]);
  });

  it("rejects a malformed body without calling the gateway", async () => {
    const handler = createSaveObservationHandler(
      authenticated,
      { save: async () => { throw new Error("not called"); } },
      () => undefined,
    );

    const response = await handler(jsonRequest({ ...completeDraft, ratings: [] }));

    expect(response.status).toBe(400);
  });

  it("maps a domain validation failure to a 400 with its message", async () => {
    const gateway: Pick<ObservationGateway, "save"> = {
      save: async () => {
        throw new Error("Les quatre comportements doivent être renseignés.");
      },
    };
    const handler = createSaveObservationHandler(authenticated, gateway, () => undefined);

    const response = await handler(jsonRequest(completeDraft));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Les quatre comportements doivent être renseignés.");
  });

  it("maps a missing educator to a 401", async () => {
    const gateway: Pick<ObservationGateway, "save"> = {
      save: async () => {
        throw new EducatorNotFoundError();
      },
    };
    const handler = createSaveObservationHandler(authenticated, gateway, () => undefined);

    const response = await handler(jsonRequest(completeDraft));

    expect(response.status).toBe(401);
  });

  it("saves and returns the report on success", async () => {
    const handler = createSaveObservationHandler(authenticated, { save: async () => report }, () => undefined);

    const response = await handler(jsonRequest(completeDraft));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ report });
  });
});

describe("createListObservationsHandler", () => {
  it("requires an authenticated session", async () => {
    const handler = createListObservationsHandler(anonymous, { list: async () => { throw new Error("not called"); } }, () => undefined);

    const response = await handler(getRequest());

    expect(response.status).toBe(401);
  });

  it("never trusts an educatorId supplied elsewhere -- only the resolved session identifies whose observations to list", async () => {
    const receivedIds: string[] = [];
    const gateway: Pick<ObservationGateway, "list"> = {
      list: async (educatorId) => {
        receivedIds.push(educatorId);
        return [record];
      },
    };
    const handler = createListObservationsHandler(authenticated, gateway, () => undefined);

    const response = await handler(getRequest());

    expect(receivedIds).toEqual([educator.id]);
    expect(await response.json()).toEqual({ observations: [record] });
  });
});

describe("createGetObservationHandler", () => {
  it("requires an authenticated session", async () => {
    const handler = createGetObservationHandler(anonymous, { get: async () => { throw new Error("not called"); } }, () => undefined);

    const response = await handler(getRequest(), record.id);

    expect(response.status).toBe(401);
  });

  it("returns the observation on success", async () => {
    const handler = createGetObservationHandler(authenticated, { get: async () => record }, () => undefined);

    const response = await handler(getRequest(), record.id);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ observation: record });
  });

  it("maps an unknown or foreign observation to a 404", async () => {
    const gateway: Pick<ObservationGateway, "get"> = {
      get: async () => {
        throw new ObservationNotFoundError();
      },
    };
    const handler = createGetObservationHandler(authenticated, gateway, () => undefined);

    const response = await handler(getRequest(), "missing");

    expect(response.status).toBe(404);
  });
});
