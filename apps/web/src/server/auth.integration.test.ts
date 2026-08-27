import { DuplicateEducatorEmailError, InvalidCredentialsError, ValidationError } from "@evolyfoot/database";
import { describe, expect, it } from "vitest";
import {
  buildClearedSessionCookie,
  buildSessionCookie,
  createLoginHandler,
  createLogoutHandler,
  createRegisterHandler,
  createSessionHandler,
  isMobileClient,
  readSessionToken,
  SESSION_COOKIE_NAME,
  type AuthGateway,
} from "./auth";

const educator = { id: "educator-1", email: "coach@example.test", displayName: "Coach" };
const expiresAt = new Date("2026-09-26T12:00:00.000Z");

function jsonRequest(body: unknown, cookie?: string, extraHeaders?: Record<string, string>): Request {
  const headers = new Headers({ "content-type": "application/json", ...extraHeaders });
  if (cookie) {
    headers.set("cookie", cookie);
  }
  return new Request("https://evolyfoot.test/api/auth/x", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("cookie helpers", () => {
  it("builds a session cookie carrying the token and its expiry", () => {
    const cookie = buildSessionCookie("le-jeton", expiresAt);

    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=le-jeton`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain(`Expires=${expiresAt.toUTCString()}`);
  });

  it("builds a cleared cookie with a zero max-age", () => {
    expect(buildClearedSessionCookie()).toContain("Max-Age=0");
  });

  it("reads the session token from a cookie header", () => {
    const request = new Request("https://evolyfoot.test", {
      headers: { cookie: `other=1; ${SESSION_COOKIE_NAME}=le-jeton; another=2` },
    });

    expect(readSessionToken(request)).toBe("le-jeton");
  });

  it("returns null when there is no session cookie", () => {
    expect(readSessionToken(new Request("https://evolyfoot.test"))).toBeNull();
  });

  it("reads a bearer token for the mobile client, taking precedence over any cookie", () => {
    const request = new Request("https://evolyfoot.test", {
      headers: { authorization: "Bearer le-jeton-mobile", cookie: `${SESSION_COOKIE_NAME}=le-jeton-cookie` },
    });

    expect(readSessionToken(request)).toBe("le-jeton-mobile");
  });

  it("identifies a mobile client from its platform header", () => {
    expect(isMobileClient(new Request("https://evolyfoot.test", { headers: { "x-client-platform": "mobile" } }))).toBe(
      true,
    );
    expect(isMobileClient(new Request("https://evolyfoot.test"))).toBe(false);
  });
});

describe("createRegisterHandler", () => {
  it("rejects a request missing a required field", async () => {
    const handler = createRegisterHandler({ register: async () => { throw new Error("not called"); } }, () => undefined);

    const response = await handler(jsonRequest({ email: "coach@example.test", password: "motdepasse1" }));

    expect(response.status).toBe(400);
  });

  it("creates the educator and sets the session cookie", async () => {
    const gateway: Pick<AuthGateway, "register"> = {
      register: async () => ({ educator, sessionToken: "le-jeton", expiresAt }),
    };
    const handler = createRegisterHandler(gateway, () => undefined);

    const response = await handler(
      jsonRequest({ email: educator.email, password: "motdepasse1", displayName: educator.displayName }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ educator });
    expect(response.headers.get("set-cookie")).toContain(`${SESSION_COOKIE_NAME}=le-jeton`);
  });

  it("also returns the raw session token in the body for the mobile client", async () => {
    const gateway: Pick<AuthGateway, "register"> = {
      register: async () => ({ educator, sessionToken: "le-jeton", expiresAt }),
    };
    const handler = createRegisterHandler(gateway, () => undefined);

    const response = await handler(
      jsonRequest(
        { email: educator.email, password: "motdepasse1", displayName: educator.displayName },
        undefined,
        { "x-client-platform": "mobile" },
      ),
    );

    expect(await response.json()).toEqual({ educator, sessionToken: "le-jeton" });
  });

  it("maps a duplicate email to a 409 without leaking internals", async () => {
    const gateway: Pick<AuthGateway, "register"> = {
      register: async () => {
        throw new DuplicateEducatorEmailError();
      },
    };
    const handler = createRegisterHandler(gateway, () => undefined);

    const response = await handler(
      jsonRequest({ email: educator.email, password: "motdepasse1", displayName: educator.displayName }),
    );

    expect(response.status).toBe(409);
  });

  it("maps a validation error to a 400 with its message", async () => {
    const gateway: Pick<AuthGateway, "register"> = {
      register: async () => {
        throw new ValidationError("Le mot de passe doit contenir au moins 10 caractères.");
      },
    };
    const handler = createRegisterHandler(gateway, () => undefined);

    const response = await handler(jsonRequest({ email: educator.email, password: "court", displayName: "Coach" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Le mot de passe doit contenir au moins 10 caractères.");
  });

  it("logs and returns an information-safe 500 for an unexpected error", async () => {
    const errors: unknown[] = [];
    const failure = new Error("postgres://secret-host/internal");
    const gateway: Pick<AuthGateway, "register"> = {
      register: async () => {
        throw failure;
      },
    };
    const handler = createRegisterHandler(gateway, errors.push.bind(errors));

    const response = await handler(
      jsonRequest({ email: educator.email, password: "motdepasse1", displayName: educator.displayName }),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("secret-host");
    expect(errors).toEqual([failure]);
  });
});

describe("createLoginHandler", () => {
  it("rejects a request missing credentials", async () => {
    const handler = createLoginHandler({ login: async () => { throw new Error("not called"); } }, () => undefined);

    const response = await handler(jsonRequest({ email: "" }));

    expect(response.status).toBe(400);
  });

  it("opens a session and sets the cookie on success", async () => {
    const gateway: Pick<AuthGateway, "login"> = {
      login: async () => ({ educator, sessionToken: "le-jeton", expiresAt }),
    };
    const handler = createLoginHandler(gateway, () => undefined);

    const response = await handler(jsonRequest({ email: educator.email, password: "motdepasse1" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ educator });
    expect(response.headers.get("set-cookie")).toContain(`${SESSION_COOKIE_NAME}=le-jeton`);
  });

  it("also returns the raw session token in the body for the mobile client", async () => {
    const gateway: Pick<AuthGateway, "login"> = {
      login: async () => ({ educator, sessionToken: "le-jeton", expiresAt }),
    };
    const handler = createLoginHandler(gateway, () => undefined);

    const response = await handler(
      jsonRequest({ email: educator.email, password: "motdepasse1" }, undefined, { "x-client-platform": "mobile" }),
    );

    expect(await response.json()).toEqual({ educator, sessionToken: "le-jeton" });
  });

  it("maps invalid credentials to a 401", async () => {
    const gateway: Pick<AuthGateway, "login"> = {
      login: async () => {
        throw new InvalidCredentialsError();
      },
    };
    const handler = createLoginHandler(gateway, () => undefined);

    const response = await handler(jsonRequest({ email: educator.email, password: "mauvaispasse" }));

    expect(response.status).toBe(401);
  });
});

describe("createLogoutHandler", () => {
  it("clears the cookie even without an existing session", async () => {
    const handler = createLogoutHandler({ logout: async () => { throw new Error("not called"); } }, () => undefined);

    const response = await handler(new Request("https://evolyfoot.test", { method: "POST" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("invalidates the session token when one is present", async () => {
    const tokens: string[] = [];
    const handler = createLogoutHandler({ logout: async (token) => { tokens.push(token); } }, () => undefined);

    await handler(new Request("https://evolyfoot.test", { method: "POST", headers: { cookie: `${SESSION_COOKIE_NAME}=le-jeton` } }));

    expect(tokens).toEqual(["le-jeton"]);
  });

  it("still clears the cookie if invalidating the session fails", async () => {
    const errors: unknown[] = [];
    const handler = createLogoutHandler(
      { logout: async () => { throw new Error("boom"); } },
      errors.push.bind(errors),
    );

    const response = await handler(
      new Request("https://evolyfoot.test", { method: "POST", headers: { cookie: `${SESSION_COOKIE_NAME}=le-jeton` } }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(errors).toHaveLength(1);
  });
});

describe("createSessionHandler", () => {
  it("returns a null educator when there is no session cookie", async () => {
    const handler = createSessionHandler({ getEducatorForSession: async () => { throw new Error("not called"); } }, () => undefined);

    const response = await handler(new Request("https://evolyfoot.test"));

    expect(await response.json()).toEqual({ educator: null });
  });

  it("returns the educator for a valid session cookie", async () => {
    const handler = createSessionHandler({ getEducatorForSession: async () => educator }, () => undefined);

    const response = await handler(
      new Request("https://evolyfoot.test", { headers: { cookie: `${SESSION_COOKIE_NAME}=le-jeton` } }),
    );

    expect(await response.json()).toEqual({ educator });
  });

  it("returns a null educator and logs when the lookup fails", async () => {
    const errors: unknown[] = [];
    const handler = createSessionHandler(
      { getEducatorForSession: async () => { throw new Error("boom"); } },
      errors.push.bind(errors),
    );

    const response = await handler(
      new Request("https://evolyfoot.test", { headers: { cookie: `${SESSION_COOKIE_NAME}=le-jeton` } }),
    );

    expect(await response.json()).toEqual({ educator: null });
    expect(errors).toHaveLength(1);
  });
});
