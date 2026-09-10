import { EducatorNotFoundError, InvalidCredentialsError, ValidationError } from "@evolyfoot/database";
import { describe, expect, it } from "vitest";
import {
  createChangePasswordHandler,
  createGetProfileHandler,
  createUpdateProfileHandler,
  type ProfileGateway,
  type ProfileSummary,
} from "./profile";

const educator = { id: "educator-1", email: "coach@example.test", displayName: "Coach" };
const authenticated = async () => educator;
const anonymous = async () => null;

const summary: ProfileSummary = {
  id: "educator-1",
  email: "coach@example.test",
  displayName: "Coach",
  birthDate: null,
  club: null,
  country: null,
  address: null,
  phone: null,
  diploma: null,
  seasonFormat: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function request(method: string, body?: unknown): Request {
  return new Request("https://evolyfoot.test/api/profile", {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("createGetProfileHandler", () => {
  it("requires authentication", async () => {
    const handler = createGetProfileHandler(anonymous, { get: async () => summary }, () => undefined);
    expect((await handler(request("GET"))).status).toBe(401);
  });

  it("returns the profile", async () => {
    const handler = createGetProfileHandler(authenticated, { get: async () => summary }, () => undefined);
    const response = await handler(request("GET"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ profile: summary });
  });
});

describe("createUpdateProfileHandler", () => {
  it("never trusts an id from the body and forwards only known fields", async () => {
    const received: Array<[string, unknown]> = [];
    const gateway: Pick<ProfileGateway, "update"> = {
      update: async (id, input) => {
        received.push([id, input]);
        return summary;
      },
    };
    const handler = createUpdateProfileHandler(authenticated, gateway, () => undefined);

    await handler(request("PATCH", { id: "attacker", club: "FC Horizon", nope: "x", phone: null }));

    expect(received).toEqual([["educator-1", { club: "FC Horizon", phone: null }]]);
  });

  it("rejects a wrongly typed field with a 400", async () => {
    const handler = createUpdateProfileHandler(
      authenticated,
      { update: async () => { throw new Error("not called"); } },
      () => undefined,
    );
    expect((await handler(request("PATCH", { club: 42 }))).status).toBe(400);
  });

  it("maps a domain validation error to a 400", async () => {
    const handler = createUpdateProfileHandler(
      authenticated,
      { update: async () => { throw new ValidationError("Le nom ne peut pas être vide."); } },
      () => undefined,
    );
    const response = await handler(request("PATCH", { displayName: " " }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Le nom ne peut pas être vide.");
  });
});

describe("createChangePasswordHandler", () => {
  it("requires both passwords", async () => {
    const handler = createChangePasswordHandler(
      authenticated,
      { changePassword: async () => { throw new Error("not called"); } },
      () => undefined,
    );
    expect((await handler(request("PATCH", { currentPassword: "only-one" }))).status).toBe(400);
  });

  it("maps a wrong current password to a 403", async () => {
    const handler = createChangePasswordHandler(
      authenticated,
      { changePassword: async () => { throw new InvalidCredentialsError(); } },
      () => undefined,
    );
    expect((await handler(request("PATCH", { currentPassword: "x", newPassword: "a-strong-password" }))).status).toBe(403);
  });

  it("maps a missing educator to a 401 and succeeds otherwise", async () => {
    const missing = createChangePasswordHandler(
      authenticated,
      { changePassword: async () => { throw new EducatorNotFoundError(); } },
      () => undefined,
    );
    expect((await missing(request("PATCH", { currentPassword: "x", newPassword: "a-strong-password" }))).status).toBe(401);

    const ok = createChangePasswordHandler(authenticated, { changePassword: async () => undefined }, () => undefined);
    expect((await ok(request("PATCH", { currentPassword: "x", newPassword: "a-strong-password" }))).status).toBe(200);
  });
});
