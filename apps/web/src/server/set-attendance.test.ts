import { describe, expect, it, vi } from "vitest";
import { createSetAttendanceHandler } from "./set-attendance";

class NotFound extends Error {}

const educator = { id: "e1", email: "coach@example.test", displayName: "Coach" } as never;

function request(body: unknown): Request {
  return new Request("http://localhost/api/matches/m1/attendance", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function handler(setAttendance: (educatorId: string, id: string, updates: unknown) => Promise<unknown>, signedIn = true) {
  const log = vi.fn();
  return {
    log,
    run: createSetAttendanceHandler({
      resolveEducator: async () => (signedIn ? educator : null),
      setAttendance,
      isNotFound: (error) => error instanceof NotFound,
      key: "match",
      log,
    }),
  };
}

describe("createSetAttendanceHandler", () => {
  it("renvoie 401 sans session", async () => {
    const { run } = handler(async () => ({}), false);
    expect((await run(request({ attendance: [] }), "m1")).status).toBe(401);
  });

  it("transmet les présences au service et renvoie le résultat sous la clé de l'événement", async () => {
    const setAttendance = vi.fn(async () => ({ id: "m1" }));
    const { run } = handler(setAttendance);
    const response = await run(request({ attendance: [{ playerId: "p1", status: "late" }] }), "m1");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ match: { id: "m1" } });
    expect(setAttendance).toHaveBeenCalledWith("e1", "m1", [{ playerId: "p1", status: "late" }]);
  });

  it("renvoie 400 pour un corps illisible", async () => {
    const { run } = handler(async () => ({}));
    expect((await run(request("{pas du json"), "m1")).status).toBe(400);
  });

  it("renvoie 404 pour un événement introuvable et 400 pour une règle métier", async () => {
    expect(
      (
        await handler(async () => {
          throw new NotFound("Match introuvable.");
        }).run(request({ attendance: [] }), "m1")
      ).status,
    ).toBe(404);

    const business = await handler(async () => {
      throw new Error("Les présences se valident une fois le match joué.");
    }).run(request({ attendance: [] }), "m1");
    expect(business.status).toBe(400);
    expect(await business.json()).toEqual({ error: "Les présences se valident une fois le match joué." });
  });

  it("n'expose pas une erreur de base de données", async () => {
    const { run, log } = handler(async () => {
      throw Object.assign(new Error("Invalid `prisma.x.findFirst()` invocation in C:\\secret"), { name: "PrismaClientKnownRequestError", code: "P2023" });
    });
    const response = await run(request({ attendance: [] }), "zzz");

    expect(response.status).toBe(404);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
    expect(log).not.toHaveBeenCalled();
  });
});
