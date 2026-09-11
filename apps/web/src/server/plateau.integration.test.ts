import { EducatorNotFoundError, PlateauNotFoundError } from "@evolyfoot/database";
import { describe, expect, it } from "vitest";
import {
  createCreatePlateauHandler,
  createGetPlateauHandler,
  createListPlateauxHandler,
  createRemovePlateauHandler,
  createUpdatePlateauDetailsHandler,
  type PlateauGateway,
  type PlateauSummary,
} from "./plateau";

const educator = { id: "educator-1", email: "coach@example.test", displayName: "Coach" };
const authenticated = async () => educator;
const anonymous = async () => null;
const summary: PlateauSummary = {
  id: "plateau-1",
  name: "Plateau de rentrée",
  dateLabel: "14 septembre 2026",
  date: null,
  location: null,
  description: null,
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

describe("createGetPlateauHandler", () => {
  it("returns 404 when the plateau does not belong to the requesting educator", async () => {
    const gateway: Pick<PlateauGateway, "get"> = {
      get: async () => {
        throw new PlateauNotFoundError();
      },
    };
    const handler = createGetPlateauHandler(authenticated, gateway, () => undefined);

    const response = await handler(new Request("https://evolyfoot.test/api/plateaux/p1"), "p1");

    expect(response.status).toBe(404);
  });
});

describe("createUpdatePlateauDetailsHandler", () => {
  it("requires authentication", async () => {
    const handler = createUpdatePlateauDetailsHandler(anonymous, { updateDetails: async () => { throw new Error("not called"); } }, () => undefined);
    expect((await handler(request("PATCH", { location: "Stade X" }), "p1")).status).toBe(401);
  });

  it("forwards only the provided fields, leaving the rest untouched", async () => {
    const received: unknown[] = [];
    const gateway: Pick<PlateauGateway, "updateDetails"> = {
      updateDetails: async (educatorId, plateauId, input) => {
        received.push({ educatorId, plateauId, input });
        return summary;
      },
    };
    const handler = createUpdatePlateauDetailsHandler(authenticated, gateway, () => undefined);

    const response = await handler(request("PATCH", { location: "Stade Marius Requier" }), "p1");

    expect(response.status).toBe(200);
    expect(received).toEqual([
      {
        educatorId: educator.id,
        plateauId: "p1",
        input: { date: undefined, location: "Stade Marius Requier", description: undefined, result: undefined },
      },
    ]);
  });

  it("accepts null to clear a field", async () => {
    const received: unknown[] = [];
    const gateway: Pick<PlateauGateway, "updateDetails"> = {
      updateDetails: async (educatorId, plateauId, input) => {
        received.push(input);
        return summary;
      },
    };
    const handler = createUpdatePlateauDetailsHandler(authenticated, gateway, () => undefined);

    await handler(request("PATCH", { location: null }), "p1");

    expect(received).toEqual([{ date: undefined, location: null, description: undefined, result: undefined }]);
  });
});
