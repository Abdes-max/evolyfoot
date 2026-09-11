import { EducatorNotFoundError, PlayerNotFoundError, ValidationError } from "@evolyfoot/database";
import { describe, expect, it } from "vitest";
import {
  createListCoachMessagesHandler,
  createListPlayerMessagesHandler,
  createSendCoachMessageHandler,
  createSendPlayerMessageHandler,
  type MessageSummary,
  type MessagingGateway,
} from "./messaging";

const educator = { id: "educator-1", email: "coach@example.test", displayName: "Coach" };
const account = { id: "account-1", email: "tuteur@example.test", displayName: "Tuteur", role: "player" as const, linkedPlayerId: "p1", emailVerified: true };
const authenticatedCoach = async () => educator;
const authenticatedPlayer = async () => account;
const anonymous = async () => null;

const message: MessageSummary = { id: "m1", authorRole: "coach", authorName: "Coach", text: "Bonjour", createdAt: "2026-09-11T12:00:00.000Z" };

function request(method: string, body?: unknown): Request {
  return new Request("https://evolyfoot.test/api/messages", {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("createListCoachMessagesHandler", () => {
  it("requires authentication", async () => {
    const handler = createListCoachMessagesHandler(anonymous, { listForCoach: async () => [] }, () => undefined);
    expect((await handler(request("GET"), "player-1")).status).toBe(401);
  });

  it("returns the thread for the requested player", async () => {
    const received: unknown[] = [];
    const gateway: Pick<MessagingGateway, "listForCoach"> = {
      listForCoach: async (educatorId, playerId) => {
        received.push({ educatorId, playerId });
        return [message];
      },
    };
    const handler = createListCoachMessagesHandler(authenticatedCoach, gateway, () => undefined);
    const response = await handler(request("GET"), "player-1");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ messages: [message] });
    expect(received).toEqual([{ educatorId: educator.id, playerId: "player-1" }]);
  });

  it("maps a player belonging to no one (or not this coach) to a 404", async () => {
    const handler = createListCoachMessagesHandler(
      authenticatedCoach,
      { listForCoach: async () => { throw new PlayerNotFoundError(); } },
      () => undefined,
    );
    expect((await handler(request("GET"), "player-1")).status).toBe(404);
  });
});

describe("createSendCoachMessageHandler", () => {
  it("rejects a missing text", async () => {
    const handler = createSendCoachMessageHandler(authenticatedCoach, { sendAsCoach: async () => { throw new Error("not called"); } }, () => undefined);
    expect((await handler(request("POST", {}), "player-1")).status).toBe(400);
  });

  it("forwards the text to the gateway", async () => {
    const received: unknown[] = [];
    const gateway: Pick<MessagingGateway, "sendAsCoach"> = {
      sendAsCoach: async (educatorId, playerId, text) => {
        received.push({ educatorId, playerId, text });
        return message;
      },
    };
    const handler = createSendCoachMessageHandler(authenticatedCoach, gateway, () => undefined);
    const response = await handler(request("POST", { text: "Bonjour" }), "player-1");
    expect(response.status).toBe(201);
    expect(received).toEqual([{ educatorId: educator.id, playerId: "player-1", text: "Bonjour" }]);
  });

  it("maps a validation error to a 400", async () => {
    const handler = createSendCoachMessageHandler(
      authenticatedCoach,
      { sendAsCoach: async () => { throw new ValidationError("Le message ne peut pas être vide."); } },
      () => undefined,
    );
    expect((await handler(request("POST", { text: "   " }), "player-1")).status).toBe(400);
  });
});

describe("createListPlayerMessagesHandler", () => {
  it("requires an authenticated player account", async () => {
    const handler = createListPlayerMessagesHandler(anonymous, { listForPlayerAccount: async () => [] }, () => undefined);
    expect((await handler(request("GET"))).status).toBe(401);
  });

  it("returns the tutor's own thread", async () => {
    const handler = createListPlayerMessagesHandler(authenticatedPlayer, { listForPlayerAccount: async () => [message] }, () => undefined);
    const response = await handler(request("GET"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ messages: [message] });
  });

  it("maps a missing linked player to a 404", async () => {
    const handler = createListPlayerMessagesHandler(
      authenticatedPlayer,
      { listForPlayerAccount: async () => { throw new EducatorNotFoundError(); } },
      () => undefined,
    );
    expect((await handler(request("GET"))).status).toBe(404);
  });
});

describe("createSendPlayerMessageHandler", () => {
  it("rejects a missing text", async () => {
    const handler = createSendPlayerMessageHandler(authenticatedPlayer, { sendAsPlayerAccount: async () => { throw new Error("not called"); } }, () => undefined);
    expect((await handler(request("POST", {}))).status).toBe(400);
  });

  it("forwards the text to the gateway using the caller's own account id", async () => {
    const received: unknown[] = [];
    const gateway: Pick<MessagingGateway, "sendAsPlayerAccount"> = {
      sendAsPlayerAccount: async (playerAccountId, text) => {
        received.push({ playerAccountId, text });
        return { ...message, authorRole: "player", authorName: "Tuteur" };
      },
    };
    const handler = createSendPlayerMessageHandler(authenticatedPlayer, gateway, () => undefined);
    const response = await handler(request("POST", { text: "On sera là samedi !" }));
    expect(response.status).toBe(201);
    expect(received).toEqual([{ playerAccountId: account.id, text: "On sera là samedi !" }]);
  });
});
