import { EducatorNotFoundError, TournamentNotFoundError } from "@evolyfoot/database";
import { describe, expect, it } from "vitest";
import {
  createCreateTournamentHandler,
  createGetTournamentHandler,
  createListTournamentsHandler,
  createRemoveTournamentHandler,
  createUpdateTournamentDetailsHandler,
  type TournamentGateway,
  type TournamentSummary,
} from "./tournament";

const educator = { id: "educator-1", email: "coach@example.test", displayName: "Coach" };
const authenticated = async () => educator;
const anonymous = async () => null;
const summary: TournamentSummary = {
  id: "tournament-1",
  name: "Tournoi de printemps",
  dateLabel: "12 avril 2026",
  date: null,
  location: null,
  description: null,
  result: null,
  createdAt: "2026-09-10T00:00:00.000Z",
};

function request(method: string, body?: unknown): Request {
  return new Request("https://evolyfoot.test/api/tournaments", {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("tournament handlers", () => {
  it("list requires authentication and returns the educator's tournaments", async () => {
    expect((await createListTournamentsHandler(anonymous, { list: async () => [] }, () => undefined)(request("GET"))).status).toBe(401);

    const response = await createListTournamentsHandler(authenticated, { list: async () => [summary] }, () => undefined)(request("GET"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ tournaments: [summary] });
  });

  it("create rejects a missing name/date and never trusts a body educatorId", async () => {
    const bad = createCreateTournamentHandler(authenticated, { create: async () => { throw new Error("not called"); } }, () => undefined);
    expect((await bad(request("POST", { name: "Tournoi" }))).status).toBe(400);

    const received: string[] = [];
    const ok = createCreateTournamentHandler(
      authenticated,
      { create: async (id) => { received.push(id); return summary; } },
      () => undefined,
    );
    const response = await ok(request("POST", { name: "Tournoi", dateLabel: "12 avril", educatorId: "attacker" }));
    expect(response.status).toBe(201);
    expect(received).toEqual([educator.id]);
  });

  it("maps a missing educator to a 401", async () => {
    const handler = createCreateTournamentHandler(
      authenticated,
      { create: async () => { throw new EducatorNotFoundError(); } },
      () => undefined,
    );
    expect((await handler(request("POST", { name: "T", dateLabel: "d" }))).status).toBe(401);
  });

  it("remove requires authentication and returns ok", async () => {
    expect((await createRemoveTournamentHandler(anonymous, { remove: async () => undefined }, () => undefined)(request("DELETE"), "t1")).status).toBe(401);
    expect((await createRemoveTournamentHandler(authenticated, { remove: async () => undefined }, () => undefined)(request("DELETE"), "t1")).status).toBe(200);
  });
});

describe("createGetTournamentHandler", () => {
  it("returns 404 when the tournament does not belong to the requesting educator", async () => {
    const gateway: Pick<TournamentGateway, "get"> = {
      get: async () => {
        throw new TournamentNotFoundError();
      },
    };
    const handler = createGetTournamentHandler(authenticated, gateway, () => undefined);

    const response = await handler(new Request("https://evolyfoot.test/api/tournaments/t1"), "t1");

    expect(response.status).toBe(404);
  });
});

describe("createUpdateTournamentDetailsHandler", () => {
  it("requires authentication", async () => {
    const handler = createUpdateTournamentDetailsHandler(anonymous, { updateDetails: async () => { throw new Error("not called"); } }, () => undefined);
    expect((await handler(request("PATCH", { location: "Stade X" }), "t1")).status).toBe(401);
  });

  it("forwards only the provided fields, leaving the rest untouched", async () => {
    const received: unknown[] = [];
    const gateway: Pick<TournamentGateway, "updateDetails"> = {
      updateDetails: async (educatorId, tournamentId, input) => {
        received.push({ educatorId, tournamentId, input });
        return summary;
      },
    };
    const handler = createUpdateTournamentDetailsHandler(authenticated, gateway, () => undefined);

    const response = await handler(request("PATCH", { location: "Stade Marius Requier" }), "t1");

    expect(response.status).toBe(200);
    expect(received).toEqual([
      {
        educatorId: educator.id,
        tournamentId: "t1",
        input: { date: undefined, location: "Stade Marius Requier", description: undefined, result: undefined },
      },
    ]);
  });

  it("accepts null to clear a field", async () => {
    const received: unknown[] = [];
    const gateway: Pick<TournamentGateway, "updateDetails"> = {
      updateDetails: async (educatorId, tournamentId, input) => {
        received.push(input);
        return summary;
      },
    };
    const handler = createUpdateTournamentDetailsHandler(authenticated, gateway, () => undefined);

    await handler(request("PATCH", { location: null }), "t1");

    expect(received).toEqual([{ date: undefined, location: null, description: undefined, result: undefined }]);
  });
});
