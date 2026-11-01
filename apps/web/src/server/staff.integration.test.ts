import { InviteInvalidError } from "@evolyfoot/database";
import { describe, expect, it, vi } from "vitest";
import type { PublicAccount } from "./auth";
import { createInviteStaffHandler, createJoinStaffHandler, createListStaffHandler, createRemoveStaffHandler } from "./staff";

const coach: PublicAccount = { id: "coach", email: "c@example.test", displayName: "Coach", role: "coach", linkedPlayerId: null, emailVerified: true };
const assistant: PublicAccount = { ...coach, id: "adjoint", role: "assistant" };
const player: PublicAccount = { ...coach, id: "joueur", role: "player" };
const request = new Request("https://evolyfoot.test/api/staff", { method: "POST" });
const origin = () => "https://evolyfoot.test";

describe("gestion du staff", () => {
  it("exige une session", async () => {
    const handler = createListStaffHandler(async () => null, { list: async () => [] }, () => undefined);

    expect((await handler(request)).status).toBe(401);
  });

  it.each([
    ["un adjoint", assistant],
    ["un joueur", player],
  ])("refuse à %s d'inviter ou de retirer", async (_, account) => {
    const invite = vi.fn();
    const remove = vi.fn();

    expect((await createInviteStaffHandler(async () => account, { invite }, origin, () => undefined)(request)).status).toBe(403);
    expect((await createRemoveStaffHandler(async () => account, { remove }, () => undefined)(request, "x")).status).toBe(403);
    expect(invite).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("renvoie le lien d'invitation à l'éducateur", async () => {
    const handler = createInviteStaffHandler(async () => coach, { invite: async () => ({ token: "abc", expiresAt: "2026-11-08" }) }, origin, () => undefined);

    const response = await handler(request);

    expect(response.status).toBe(201);
    expect((await response.json()).url).toBe("https://evolyfoot.test/rejoindre/staff/abc");
  });

  it("ouvre une session à l'inscription de l'adjoint", async () => {
    const join = async () => ({ account: assistant, sessionToken: "jeton", expiresAt: new Date("2026-12-01") });
    const handler = createJoinStaffHandler({ join }, () => undefined);

    const response = await handler(new Request("https://evolyfoot.test", { method: "POST", body: JSON.stringify({ token: "t", email: "a@b.c", password: "p", displayName: "A" }) }));

    expect(response.status).toBe(201);
    expect(response.headers.get("set-cookie")).toContain("evolyfoot_session=jeton");
  });

  it("refuse un lien périmé", async () => {
    const join = async () => {
      throw new InviteInvalidError();
    };
    const handler = createJoinStaffHandler({ join }, () => undefined);

    const response = await handler(new Request("https://evolyfoot.test", { method: "POST", body: JSON.stringify({ token: "t", email: "a@b.c", password: "p", displayName: "A" }) }));

    expect(response.status).toBe(410);
  });
});
