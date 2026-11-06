import { PlayerNotFoundError, ValidationError } from "@evolyfoot/database";
import { describe, expect, it } from "vitest";
import { createTutorsHandlers, type TutorsGateway } from "./tutors";

const educator = { id: "educator-1", email: "coach@example.test", displayName: "Coach" };
const empty = { tutors: [], requests: [] };

function request(method: string, body?: unknown): Request {
  return new Request("https://evolyfoot.test/api/roster/p1/tuteurs", {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function gateway(received: unknown[]): TutorsGateway {
  return {
    list: async (educatorId, playerId) => {
      if (playerId === "other") throw new PlayerNotFoundError();
      received.push({ action: "list", educatorId, playerId });
      return empty;
    },
    answer: async (educatorId, playerId, requestId, accept) => {
      if (requestId === "gone") throw new ValidationError("Cette demande n’existe plus.");
      received.push({ action: "answer", educatorId, playerId, requestId, accept });
      return empty;
    },
    remove: async (educatorId, playerId, accountId) => {
      received.push({ action: "remove", educatorId, playerId, accountId });
      return empty;
    },
  };
}

describe("createTutorsHandlers", () => {
  it("requires a coach session", async () => {
    const handlers = createTutorsHandlers(
      async () => null,
      gateway([]),
      () => undefined,
    );
    expect((await handlers.list(request("GET"), "p1")).status).toBe(401);
  });

  it("lists, answers and removes for the coach's player only", async () => {
    const received: unknown[] = [];
    const handlers = createTutorsHandlers(
      async () => educator,
      gateway(received),
      () => undefined,
    );

    expect((await handlers.list(request("GET"), "p1")).status).toBe(200);
    expect((await handlers.list(request("GET"), "other")).status).toBe(404);
    expect((await handlers.answer(request("POST", { requestId: "r1", accept: true }), "p1")).status).toBe(200);
    expect((await handlers.answer(request("POST", { requestId: "r1" }), "p1")).status).toBe(400);
    expect((await handlers.answer(request("POST", { requestId: "gone", accept: false }), "p1")).status).toBe(400);
    expect((await handlers.remove(request("DELETE", { accountId: "a1" }), "p1")).status).toBe(200);
    expect(received).toEqual([
      { action: "list", educatorId: "educator-1", playerId: "p1" },
      { action: "answer", educatorId: "educator-1", playerId: "p1", requestId: "r1", accept: true },
      { action: "remove", educatorId: "educator-1", playerId: "p1", accountId: "a1" },
    ]);
  });
});
