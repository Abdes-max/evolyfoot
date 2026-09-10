import { EducatorNotFoundError } from "@evolyfoot/database";
import { describe, expect, it } from "vitest";
import {
  createCreatePlateauHandler,
  createListPlateauxHandler,
  createRemovePlateauHandler,
  type PlateauSummary,
} from "./plateau";

const educator = { id: "educator-1", email: "coach@example.test", displayName: "Coach" };
const authenticated = async () => educator;
const anonymous = async () => null;
const summary: PlateauSummary = {
  id: "plateau-1",
  name: "Plateau de rentrée",
  dateLabel: "14 septembre 2026",
  result: null,
  createdAt: "2026-09-10T00:00:00.000Z",
};

function request(method: string, body?: unknown): Request {
  return new Request("https://evolyfoot.test/api/plateaux", {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("plateau handlers", () => {
  it("list requires authentication and returns the educator's plateaux", async () => {
    expect((await createListPlateauxHandler(anonymous, { list: async () => [] }, () => undefined)(request("GET"))).status).toBe(401);

    const response = await createListPlateauxHandler(authenticated, { list: async () => [summary] }, () => undefined)(request("GET"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ plateaux: [summary] });
  });

  it("create rejects a missing name/date and never trusts a body educatorId", async () => {
    const bad = createCreatePlateauHandler(authenticated, { create: async () => { throw new Error("not called"); } }, () => undefined);
    expect((await bad(request("POST", { name: "Plateau" }))).status).toBe(400);

    const received: string[] = [];
    const ok = createCreatePlateauHandler(
      authenticated,
      { create: async (id) => { received.push(id); return summary; } },
      () => undefined,
    );
    const response = await ok(request("POST", { name: "Plateau", dateLabel: "14 sept.", educatorId: "attacker" }));
    expect(response.status).toBe(201);
    expect(received).toEqual([educator.id]);
  });

  it("maps a missing educator to a 401", async () => {
    const handler = createCreatePlateauHandler(
      authenticated,
      { create: async () => { throw new EducatorNotFoundError(); } },
      () => undefined,
    );
    expect((await handler(request("POST", { name: "P", dateLabel: "d" }))).status).toBe(401);
  });

  it("remove requires authentication and returns ok", async () => {
    expect((await createRemovePlateauHandler(anonymous, { remove: async () => undefined }, () => undefined)(request("DELETE"), "p1")).status).toBe(401);
    expect((await createRemovePlateauHandler(authenticated, { remove: async () => undefined }, () => undefined)(request("DELETE"), "p1")).status).toBe(200);
  });
});
