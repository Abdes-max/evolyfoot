import { InviteInvalidError, PlayerAccountExistsError } from "@evolyfoot/database";
import { describe, expect, it } from "vitest";
import {
  createConsumeInviteHandler,
  createCreateInviteHandler,
  createPreviewInviteHandler,
  type PlayerInviteGateway,
} from "./player-invite";

const educator = { id: "educator-1", email: "coach@example.test", displayName: "Coach" };
const authenticated = async () => educator;
const anonymous = async () => null;

function request(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("createCreateInviteHandler", () => {
  it("requires an authenticated coach and a playerId", async () => {
    const anon = createCreateInviteHandler(anonymous, { create: async () => { throw new Error("nope"); } }, () => undefined);
    expect((await anon(request("POST", "https://evolyfoot.test/api/invites", { playerId: "p1" }))).status).toBe(401);

    const noPlayer = createCreateInviteHandler(authenticated, { create: async () => { throw new Error("nope"); } }, () => undefined);
    expect((await noPlayer(request("POST", "https://evolyfoot.test/api/invites", {}))).status).toBe(400);
  });

  it("builds an absolute /rejoindre URL from the request origin", async () => {
    const handler = createCreateInviteHandler(
      authenticated,
      { create: async () => ({ token: "abc123", expiresAt: "2026-09-24T00:00:00.000Z" }) },
      () => undefined,
    );
    const response = await handler(request("POST", "https://evolyfoot.com/api/invites", { playerId: "p1" }));
    expect(response.status).toBe(201);
    expect((await response.json()).url).toBe("https://evolyfoot.com/rejoindre/abc123");
  });

  it("builds a usable http://localhost URL in local dev, even if the request came in as https://0.0.0.0", async () => {
    // `next dev` écoute sur toutes les interfaces sans jamais servir de TLS ; un Host
    // "0.0.0.0:3000" (adresse d'écoute, pas une adresse joignable) ne doit jamais finir dans un
    // lien envoyé à un tuteur.
    const handler = createCreateInviteHandler(
      authenticated,
      { create: async () => ({ token: "abc123", expiresAt: "2026-09-24T00:00:00.000Z" }) },
      () => undefined,
    );
    const response = await handler(request("POST", "https://0.0.0.0:3000/api/invites", { playerId: "p1" }));
    expect((await response.json()).url).toBe("http://localhost:3000/rejoindre/abc123");
  });

  it("maps 'account already exists' to 409", async () => {
    const handler = createCreateInviteHandler(
      authenticated,
      { create: async () => { throw new PlayerAccountExistsError(); } },
      () => undefined,
    );
    expect((await handler(request("POST", "https://evolyfoot.test/api/invites", { playerId: "p1" }))).status).toBe(409);
  });
});

describe("createPreviewInviteHandler", () => {
  it("returns the preview or 404 for an invalid token", async () => {
    const ok = createPreviewInviteHandler(
      { preview: async () => ({ playerName: "Kylian", teamName: "FC Horizon", coachName: "Coach" }) },
      () => undefined,
    );
    const response = await ok(request("GET", "https://evolyfoot.test/api/invites/abc"), "abc");
    expect(response.status).toBe(200);
    expect((await response.json()).invite.playerName).toBe("Kylian");

    const missing = createPreviewInviteHandler({ preview: async () => null }, () => undefined);
    expect((await missing(request("GET", "https://evolyfoot.test/api/invites/x"), "x")).status).toBe(404);
  });
});

describe("createConsumeInviteHandler", () => {
  it("requires all fields", async () => {
    const handler = createConsumeInviteHandler(
      { consume: async () => { throw new Error("nope"); } } as Pick<PlayerInviteGateway, "consume">,
      () => undefined,
    );
    expect(
      (await handler(request("POST", "https://evolyfoot.test/api/auth/register-player", { token: "t", email: "e@x.t" }))).status,
    ).toBe(400);
  });

  it("sets a session cookie and returns the account on success", async () => {
    const handler = createConsumeInviteHandler(
      {
        consume: async () => ({
          account: { id: "acc-1", email: "t@x.t", displayName: "Tuteur", role: "player", linkedPlayerId: "p1" },
          sessionToken: "sess-token",
          expiresAt: new Date("2026-10-10T00:00:00.000Z"),
        }),
      },
      () => undefined,
    );
    const response = await handler(
      request("POST", "https://evolyfoot.test/api/auth/register-player", {
        token: "t",
        email: "t@x.t",
        password: "a-strong-password",
        displayName: "Tuteur",
      }),
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("set-cookie")).toContain("evolyfoot_session=sess-token");
    expect((await response.json()).account.role).toBe("player");
  });

  it("maps an invalid/expired invite to 410", async () => {
    const handler = createConsumeInviteHandler(
      { consume: async () => { throw new InviteInvalidError(); } },
      () => undefined,
    );
    const response = await handler(
      request("POST", "https://evolyfoot.test/api/auth/register-player", {
        token: "t",
        email: "t@x.t",
        password: "a-strong-password",
        displayName: "Tuteur",
      }),
    );
    expect(response.status).toBe(410);
  });
});
