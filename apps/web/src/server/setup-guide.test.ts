import { describe, expect, it, vi } from "vitest";
import type { PublicAccount } from "./auth";
import { createDismissSetupGuideHandler, createGetSetupGuideHandler } from "./setup-guide";

const guide = { steps: [{ id: "players" as const, done: true }], done: 1, total: 7, dismissed: false };
const coach: PublicAccount = { id: "coach-1", email: "c@example.test", displayName: "Coach", role: "coach", linkedPlayerId: null, emailVerified: true };

function resolvers(account: PublicAccount | null) {
  return { resolveAccount: async () => account, resolveTeam: async () => (account ? { id: "team-1" } : null) };
}

describe("guide de configuration (API)", () => {
  it("renvoie l'avancement de l'équipe active pour le compte du coach", async () => {
    const gateway = { get: vi.fn(async () => guide) };
    const response = await createGetSetupGuideHandler(resolvers(coach), gateway, vi.fn())(new Request("http://localhost/api/setup-guide"));

    expect(response.status).toBe(200);
    expect(gateway.get).toHaveBeenCalledWith("coach-1", "team-1");
    expect((await response.json()).guide).toEqual(guide);
  });

  it("refuse sans session (401) et pour un autre rôle (403)", async () => {
    const gateway = { get: vi.fn(async () => guide) };
    expect((await createGetSetupGuideHandler(resolvers(null), gateway, vi.fn())(new Request("http://localhost/api/setup-guide"))).status).toBe(401);
    expect(
      (await createGetSetupGuideHandler(resolvers({ ...coach, role: "assistant" }), gateway, vi.fn())(new Request("http://localhost/api/setup-guide"))).status,
    ).toBe(403);
    expect(gateway.get).not.toHaveBeenCalled();
  });

  it("ferme le guide, ou le rouvre avec dismissed:false", async () => {
    const gateway = { setDismissed: vi.fn(async () => undefined) };
    const handler = createDismissSetupGuideHandler(resolvers(coach), gateway, vi.fn());

    await handler(new Request("http://localhost/api/setup-guide/dismiss", { method: "POST", body: JSON.stringify({}) }));
    expect(gateway.setDismissed).toHaveBeenLastCalledWith("coach-1", true);
    await handler(new Request("http://localhost/api/setup-guide/dismiss", { method: "POST", body: JSON.stringify({ dismissed: false }) }));
    expect(gateway.setDismissed).toHaveBeenLastCalledWith("coach-1", false);
  });
});
