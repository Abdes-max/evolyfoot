import { EducatorNotFoundError, InvalidCredentialsError, ValidationError } from "@evolyfoot/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimits } from "./rate-limit";
import { createSuperAdminHandlers, type SuperAdminApi } from "./super-admin";

const superAdmin = { id: "sa1", email: "admin@example.test", displayName: "Admin", createdAt: new Date(), lastLoginAt: null };

function fakeApi(overrides: Partial<SuperAdminApi> = {}): SuperAdminApi {
  return {
    login: vi.fn(async () => ({ superAdmin, sessionToken: "token-sa", expiresAt: new Date("2030-01-01T00:00:00Z") })),
    logout: vi.fn(async () => undefined),
    getBySession: vi.fn(async (token: string) => (token === "token-sa" ? superAdmin : null)),
    changePassword: vi.fn(async () => undefined),
    stats: vi.fn(async () => ({ educators: {}, access: {}, content: {} }) as never),
    listEducators: vi.fn(async () => ({ items: [], total: 0 })),
    getEducator: vi.fn(async () => ({ id: "e1", email: "coach@example.test" }) as never),
    suspend: vi.fn(async () => undefined),
    reactivate: vi.fn(async () => undefined),
    setTest: vi.fn(async () => undefined),
    verifyEmail: vi.fn(async () => undefined),
    extendTrial: vi.fn(async () => new Date()),
    deleteEducator: vi.fn(async () => undefined),
    startImpersonation: vi.fn(async () => ({ sessionToken: "token-educator", expiresAt: new Date("2030-01-01T00:30:00Z") })),
    stopImpersonation: vi.fn(async () => true),
    impersonationOf: vi.fn(async () => null),
    listAudit: vi.fn(async () => ({ items: [], total: 0 })),
    ...overrides,
  };
}

function request(path: string, options: { method?: string; body?: unknown; cookie?: string; address?: string } = {}): Request {
  return new Request(`http://localhost/api/super-admin/${path}`, {
    method: options.method ?? "GET",
    headers: { "content-type": "application/json", ...(options.cookie ? { cookie: options.cookie } : {}), "x-forwarded-for": options.address ?? "10.0.0.1" },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
}

const authenticated = "evolyfoot_superadmin=token-sa";

describe("handlers superadmin", () => {
  beforeEach(() => resetRateLimits());

  it("refuse toute route sans cookie superadmin, y compris avec un cookie d'éducateur", async () => {
    const api = fakeApi();
    const handlers = createSuperAdminHandlers(api, vi.fn());

    expect((await handlers.stats(request("stats"))).status).toBe(401);
    expect((await handlers.listEducators(request("educators"))).status).toBe(401);
    expect((await handlers.auditLog(request("audit-log"))).status).toBe(401);
    // Le jeton d'une session d'éducateur n'est jamais présenté comme jeton superadmin.
    expect((await handlers.stats(request("stats", { cookie: "evolyfoot_session=token-sa" }))).status).toBe(401);
    expect((await handlers.stats(request("stats", { cookie: "evolyfoot_superadmin=autre" }))).status).toBe(401);
    expect(api.stats).not.toHaveBeenCalled();
  });

  it("connecte avec un cookie HttpOnly SameSite=Strict et refuse les mauvais identifiants", async () => {
    const api = fakeApi();
    const handlers = createSuperAdminHandlers(api, vi.fn());

    const response = await handlers.login(request("auth/login", { method: "POST", body: { email: "admin@example.test", password: "un-mot-de-passe-long-1" } }));
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(response.status).toBe(200);
    expect(cookie).toContain("evolyfoot_superadmin=token-sa");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(JSON.stringify(await response.json())).not.toContain("password");

    const failing = createSuperAdminHandlers(
      fakeApi({
        login: vi.fn(async () => {
          throw new InvalidCredentialsError();
        }),
      }),
      vi.fn(),
    );
    expect((await failing.login(request("auth/login", { method: "POST", body: { email: "a@b.fr", password: "x" }, address: "10.0.0.2" }))).status).toBe(401);
    expect((await handlers.login(request("auth/login", { method: "POST", body: {}, address: "10.0.0.3" }))).status).toBe(400);
  });

  it("limite les essais de connexion à 5 par quart d'heure et par adresse", async () => {
    const handlers = createSuperAdminHandlers(fakeApi(), vi.fn());
    const attempt = () => handlers.login(request("auth/login", { method: "POST", body: { email: "a@b.fr", password: "x" }, address: "10.9.9.9" }));

    for (let i = 0; i < 5; i += 1) {
      expect((await attempt()).status).not.toBe(429);
    }
    expect((await attempt()).status).toBe(429);
  });

  it("déconnecte en supprimant la session et le cookie", async () => {
    const api = fakeApi();
    const response = await createSuperAdminHandlers(api, vi.fn()).logout(request("auth/logout", { method: "POST", cookie: authenticated }));

    expect(api.logout).toHaveBeenCalledWith("token-sa");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("applique une action sur un éducateur au nom du superadmin connecté", async () => {
    const api = fakeApi();
    const handlers = createSuperAdminHandlers(api, vi.fn());

    expect(
      (await handlers.educatorAction(request("educators/e1/suspend", { method: "POST", cookie: authenticated, body: { note: "Abus" } }), "e1", "suspend"))
        .status,
    ).toBe(200);
    expect(api.suspend).toHaveBeenCalledWith("sa1", "e1", "Abus");

    await handlers.educatorAction(request("educators/e1/extend-trial", { method: "POST", cookie: authenticated, body: { days: 30 } }), "e1", "extend-trial");
    expect(api.extendTrial).toHaveBeenCalledWith("sa1", "e1", 30, undefined);

    await handlers.educatorAction(request("educators/e1/mark-test", { method: "POST", cookie: authenticated }), "e1", "mark-test");
    expect(api.setTest).toHaveBeenCalledWith("sa1", "e1", true);

    expect((await handlers.educatorAction(request("educators/e1/inconnue", { method: "POST", cookie: authenticated }), "e1", "inconnue")).status).toBe(404);
  });

  it("ouvre la session « en tant que » avec le cookie de l'éducateur et garde le cookie superadmin", async () => {
    const api = fakeApi();
    const response = await createSuperAdminHandlers(api, vi.fn()).educatorAction(
      request("educators/e1/impersonate", { method: "POST", cookie: authenticated }),
      "e1",
      "impersonate",
    );

    expect(api.startImpersonation).toHaveBeenCalledWith("sa1", "e1");
    expect(response.headers.get("set-cookie")).toContain("evolyfoot_session=token-educator");
    expect(await response.json()).toEqual({ redirect: "/app" });
  });

  it("traduit les erreurs métier sans fuite et exige l'e-mail pour supprimer", async () => {
    const api = fakeApi({
      deleteEducator: vi.fn(async () => {
        throw new ValidationError("Saisis l'adresse e-mail du compte pour confirmer la suppression.");
      }),
      getEducator: vi.fn(async () => {
        throw new EducatorNotFoundError();
      }),
    });
    const handlers = createSuperAdminHandlers(api, vi.fn());

    const deletion = await handlers.deleteEducator(
      request("educators/e1", { method: "DELETE", cookie: authenticated, body: { confirmEmail: "faux@example.test" } }),
      "e1",
    );
    expect(deletion.status).toBe(400);
    expect(api.deleteEducator).toHaveBeenCalledWith("sa1", "e1", "faux@example.test");
    expect((await handlers.getEducator(request("educators/zzz", { cookie: authenticated }), "zzz")).status).toBe(404);
  });

  it("ferme l'impersonation depuis la session de l'éducateur et efface son cookie", async () => {
    const api = fakeApi();
    const handlers = createSuperAdminHandlers(api, vi.fn());

    const response = await handlers.stopImpersonation(request("x", { method: "POST", cookie: "evolyfoot_session=token-educator" }));
    expect(api.stopImpersonation).toHaveBeenCalledWith("token-educator");
    expect(response.headers.get("set-cookie")).toContain("evolyfoot_session=;");
    expect(await response.json()).toEqual({ redirect: "/super-admin" });

    const none = createSuperAdminHandlers(fakeApi({ stopImpersonation: vi.fn(async () => false) }), vi.fn());
    expect((await none.stopImpersonation(request("x", { method: "POST", cookie: "evolyfoot_session=normal" }))).status).toBe(400);
  });
});
