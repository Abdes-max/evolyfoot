import { EducatorNotFoundError, ValidationError } from "@evolyfoot/database";
import { describe, expect, it } from "vitest";
import { createRespondToMatchHandler } from "./player-rsvp";

const account = { id: "account-1", email: "tuteur@example.test", displayName: "Tuteur", role: "player" as const, linkedPlayerId: "p1", emailVerified: true };
const authenticated = async () => account;
const anonymous = async () => null;

function request(body?: unknown): Request {
  return new Request("https://evolyfoot.test/api/joueur/rsvp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("createRespondToMatchHandler", () => {
  it("requires an authenticated player account", async () => {
    const handler = createRespondToMatchHandler(anonymous, { respondToMatch: async () => { throw new Error("not called"); } }, () => undefined);
    expect((await handler(request({ matchId: "m1", status: "present" }))).status).toBe(401);
  });

  it("rejects a missing matchId or an invalid status", async () => {
    const handler = createRespondToMatchHandler(authenticated, { respondToMatch: async () => { throw new Error("not called"); } }, () => undefined);
    expect((await handler(request({ status: "present" }))).status).toBe(400);
    expect((await handler(request({ matchId: "m1", status: "sur-la-lune" }))).status).toBe(400);
  });

  it("forwards a valid RSVP to the gateway", async () => {
    const received: unknown[] = [];
    const handler = createRespondToMatchHandler(
      authenticated,
      { respondToMatch: async (accountId, matchId, status) => { received.push({ accountId, matchId, status }); } },
      () => undefined,
    );
    const response = await handler(request({ matchId: "m1", status: "injured" }));
    expect(response.status).toBe(200);
    expect(received).toEqual([{ accountId: "account-1", matchId: "m1", status: "injured" }]);
  });

  it("maps a match belonging to no one (or not this player) to a 404", async () => {
    const handler = createRespondToMatchHandler(
      authenticated,
      { respondToMatch: async () => { throw new EducatorNotFoundError(); } },
      () => undefined,
    );
    expect((await handler(request({ matchId: "m1", status: "present" }))).status).toBe(404);
  });

  it("maps a match already played to a 400", async () => {
    const handler = createRespondToMatchHandler(
      authenticated,
      { respondToMatch: async () => { throw new ValidationError("Ce match a déjà eu lieu."); } },
      () => undefined,
    );
    expect((await handler(request({ matchId: "m1", status: "present" }))).status).toBe(400);
  });
});
