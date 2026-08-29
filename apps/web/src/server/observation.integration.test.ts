import { EducatorNotFoundError } from "@evolyfoot/database";
import { diagnosticCriteria, type ObservationDraft, type ObservationReport } from "@evolyfoot/domain";
import { describe, expect, it } from "vitest";
import { createSaveObservationHandler, type ObservationGateway } from "./observation";

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
