import { beforeEach, describe, expect, it } from "vitest";
import { clientAddress, hitRateLimit, limitByAddress, limitLogin, minute, resetRateLimits } from "./rate-limit";

function loginRequest(email: string, address: string): Request {
  return new Request("https://evolyfoot.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": address },
    body: JSON.stringify({ email, password: "motdepasse" }),
  });
}

describe("limite de tentatives", () => {
  beforeEach(() => resetRateLimits());

  it("bloque au-delà de la limite puis repart après la fenêtre", () => {
    expect(hitRateLimit("k", 2, minute, 0)).toBeNull();
    expect(hitRateLimit("k", 2, minute, 1)).toBeNull();
    expect(hitRateLimit("k", 2, minute, 2)).toBe(60);
    expect(hitRateLimit("k", 2, minute, minute + 1)).toBeNull();
  });

  it("garde l'adresse ajoutée par le proxy, pas celle fournie par le client", () => {
    const request = new Request("https://evolyfoot.test", { headers: { "x-forwarded-for": "1.1.1.1, 203.0.113.9" } });

    expect(clientAddress(request)).toBe("203.0.113.9");
  });

  it("répond 429 avec le délai d'attente", () => {
    const request = new Request("https://evolyfoot.test", { headers: { "x-forwarded-for": "203.0.113.9" } });
    expect(limitByAddress(request, "contact", 1, minute)).toBeNull();

    const blocked = limitByAddress(request, "contact", 1, minute);

    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get("Retry-After")).toBe("60");
  });

  it("freine les essais sur un compte sans bloquer les autres adresses", async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect(await limitLogin(loginRequest("coach@example.test", "203.0.113.9"))).toBeNull();
    }

    expect((await limitLogin(loginRequest("COACH@example.test", "203.0.113.9")))?.status).toBe(429);
    expect(await limitLogin(loginRequest("coach@example.test", "198.51.100.7"))).toBeNull();
    expect(await limitLogin(loginRequest("autre@example.test", "203.0.113.9"))).toBeNull();
  });

  it("laisse le corps de la requête lisible", async () => {
    const request = loginRequest("coach@example.test", "203.0.113.9");

    await limitLogin(request);

    expect(await request.json()).toMatchObject({ email: "coach@example.test" });
  });
});
