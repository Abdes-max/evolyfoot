import { EducatorNotFoundError } from "@evolyfoot/database";
import type { DiagnosticScores } from "@evolyfoot/domain";
import { describe, expect, it } from "vitest";
import { createGetDiagnosticHandler, createSaveDiagnosticHandler, type DiagnosticGateway } from "./diagnostic";

const educator = { id: "educator-1", email: "coach@example.test", displayName: "Coach" };
const validScores: DiagnosticScores = { availability: 3, scanning: 2, progression: 4, reactionAfterLoss: 1 };

function jsonRequest(body: unknown): Request {
  return new Request("https://evolyfoot.test/api/diagnostic", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const authenticated = async () => educator;
const anonymous = async () => null;

describe("createGetDiagnosticHandler", () => {
  it("requires an authenticated session", async () => {
    const handler = createGetDiagnosticHandler(
      anonymous,
      { get: async () => { throw new Error("not called"); } },
      () => undefined,
    );

    const response = await handler(new Request("https://evolyfoot.test/api/diagnostic"));

    expect(response.status).toBe(401);
  });

  it("returns the educator's diagnostic scores", async () => {
    const handler = createGetDiagnosticHandler(authenticated, { get: async () => validScores }, () => undefined);

    const response = await handler(new Request("https://evolyfoot.test/api/diagnostic"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ scores: validScores });
  });

  it("returns null scores when the educator has no diagnostic yet", async () => {
    const handler = createGetDiagnosticHandler(authenticated, { get: async () => null }, () => undefined);

    const response = await handler(new Request("https://evolyfoot.test/api/diagnostic"));

    expect(await response.json()).toEqual({ scores: null });
  });

  it("logs and returns an information-safe 500 for an unexpected error", async () => {
    const errors: unknown[] = [];
    const failure = new Error("postgres://secret-host/internal");
    const handler = createGetDiagnosticHandler(
      authenticated,
      { get: async () => { throw failure; } },
      errors.push.bind(errors),
    );

    const response = await handler(new Request("https://evolyfoot.test/api/diagnostic"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("secret-host");
    expect(errors).toEqual([failure]);
  });
});

describe("createSaveDiagnosticHandler", () => {
  it("requires an authenticated session before reading the body", async () => {
    const handler = createSaveDiagnosticHandler(
      anonymous,
      { save: async () => { throw new Error("not called"); } },
      () => undefined,
    );

    const response = await handler(jsonRequest(validScores));

    expect(response.status).toBe(401);
  });

  it("never trusts an educatorId supplied in the request body", async () => {
    const receivedIds: string[] = [];
    const gateway: Pick<DiagnosticGateway, "save"> = {
      save: async (educatorId) => {
        receivedIds.push(educatorId);
        return validScores;
      },
    };
    const handler = createSaveDiagnosticHandler(authenticated, gateway, () => undefined);

    await handler(jsonRequest({ ...validScores, educatorId: "attacker-supplied-id" }));

    expect(receivedIds).toEqual([educator.id]);
  });

  it("rejects a malformed body without calling the gateway", async () => {
    const handler = createSaveDiagnosticHandler(
      authenticated,
      { save: async () => { throw new Error("not called"); } },
      () => undefined,
    );

    const response = await handler(jsonRequest({ availability: 3 }));

    expect(response.status).toBe(400);
  });

  it("maps a domain validation failure to a 400 with its message", async () => {
    const gateway: Pick<DiagnosticGateway, "save"> = {
      save: async () => {
        throw new Error("Chaque critère doit être évalué de 1 à 4.");
      },
    };
    const handler = createSaveDiagnosticHandler(authenticated, gateway, () => undefined);

    const response = await handler(jsonRequest(validScores));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Chaque critère doit être évalué de 1 à 4.");
  });

  it("maps a missing educator to a 401", async () => {
    const gateway: Pick<DiagnosticGateway, "save"> = {
      save: async () => {
        throw new EducatorNotFoundError();
      },
    };
    const handler = createSaveDiagnosticHandler(authenticated, gateway, () => undefined);

    const response = await handler(jsonRequest(validScores));

    expect(response.status).toBe(401);
  });

  it("saves and returns the scores on success", async () => {
    const handler = createSaveDiagnosticHandler(
      authenticated,
      { save: async (_id, scores) => scores },
      () => undefined,
    );

    const response = await handler(jsonRequest(validScores));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ scores: validScores });
  });
});
