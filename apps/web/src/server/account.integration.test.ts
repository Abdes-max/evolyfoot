import { InvalidCredentialsError } from "@evolyfoot/database";
import { describe, expect, it } from "vitest";
import { createDeleteAccountHandler, createExportAccountHandler } from "./account";
import type { PublicAccount } from "./auth";

const account: PublicAccount = { id: "compte-1", email: "coach@example.test", displayName: "Coach", role: "coach", linkedPlayerId: null, emailVerified: true };
const authenticated = async () => account;
const anonymous = async () => null;

function deleteRequest(body: unknown): Request {
  return new Request("https://evolyfoot.test/api/account", { method: "DELETE", body: JSON.stringify(body) });
}

describe("createExportAccountHandler", () => {
  it("exige une session", async () => {
    const handler = createExportAccountHandler(anonymous, { exportData: async () => ({}) }, () => undefined);

    expect((await handler(new Request("https://evolyfoot.test/api/account/export"))).status).toBe(401);
  });

  it("renvoie un fichier à télécharger", async () => {
    const handler = createExportAccountHandler(authenticated, { exportData: async () => ({ id: "compte-1" }) }, () => undefined);

    const response = await handler(new Request("https://evolyfoot.test/api/account/export"));

    expect(response.headers.get("content-disposition")).toContain("mes-donnees-evolyfoot.json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ id: "compte-1" });
  });
});

describe("createDeleteAccountHandler", () => {
  it("exige le mot de passe", async () => {
    const handler = createDeleteAccountHandler(authenticated, { deleteAccount: async () => undefined }, () => undefined);

    expect((await handler(deleteRequest({}))).status).toBe(400);
  });

  it("refuse un mauvais mot de passe", async () => {
    const gateway = {
      deleteAccount: async () => {
        throw new InvalidCredentialsError();
      },
    };
    const handler = createDeleteAccountHandler(authenticated, gateway, () => undefined);

    expect((await handler(deleteRequest({ password: "mauvais" }))).status).toBe(403);
  });

  it("supprime le compte et efface le cookie de session", async () => {
    const deleted: string[] = [];
    const handler = createDeleteAccountHandler(authenticated, { deleteAccount: async (id) => void deleted.push(id) }, () => undefined);

    const response = await handler(deleteRequest({ password: "bon" }));

    expect(response.status).toBe(200);
    expect(deleted).toEqual(["compte-1"]);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
