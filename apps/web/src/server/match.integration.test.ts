import { EducatorNotFoundError, MatchNotFoundError } from "@evolyfoot/database";
import { describe, expect, it } from "vitest";
import {
  createChangeFormationHandler,
  createCreateMatchHandler,
  createGetMatchHandler,
  createListMatchesHandler,
  createMarkPlayedHandler,
  createRemoveMatchHandler,
  createUpdateLineupHandler,
  type MatchGateway,
  type MatchSummary,
} from "./match";

const educator = { id: "educator-1", email: "coach@example.test", displayName: "Coach" };
const match: MatchSummary = {
  id: "match-1",
  opponent: "US Vallée",
  dateLabel: "Samedi",
  venue: "home",
  gameFormat: 8,
  formationId: "3-3-1",
  status: "scheduled",
  lineup: [],
  captainPlayerId: null,
  substitutePlayerIds: [],
};

function jsonRequest(method: string, body?: unknown): Request {
  return new Request("https://evolyfoot.test/api/matches", {
    method,
    headers: { "content-type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const authenticated = async () => educator;
const anonymous = async () => null;

describe("createListMatchesHandler", () => {
  it("requires an authenticated session", async () => {
    const handler = createListMatchesHandler(anonymous, { list: async () => { throw new Error("not called"); } }, () => undefined);

    const response = await handler(new Request("https://evolyfoot.test/api/matches"));

    expect(response.status).toBe(401);
  });

  it("returns the educator's matches", async () => {
    const handler = createListMatchesHandler(authenticated, { list: async () => [match] }, () => undefined);

    const response = await handler(new Request("https://evolyfoot.test/api/matches"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ matches: [match] });
  });
});

describe("createCreateMatchHandler", () => {
  it("requires an authenticated session before reading the body", async () => {
    const handler = createCreateMatchHandler(anonymous, { create: async () => { throw new Error("not called"); } }, () => undefined);

    const response = await handler(jsonRequest("POST", { opponent: "US Vallée" }));

    expect(response.status).toBe(401);
  });

  it("rejects a request missing required fields", async () => {
    const handler = createCreateMatchHandler(authenticated, { create: async () => { throw new Error("not called"); } }, () => undefined);

    const response = await handler(jsonRequest("POST", { opponent: "US Vallée" }));

    expect(response.status).toBe(400);
  });

  it("never trusts an educatorId supplied in the request body", async () => {
    const receivedIds: string[] = [];
    const gateway: Pick<MatchGateway, "create"> = {
      create: async (educatorId) => {
        receivedIds.push(educatorId);
        return match;
      },
    };
    const handler = createCreateMatchHandler(authenticated, gateway, () => undefined);

    await handler(jsonRequest("POST", { educatorId: "someone-else", opponent: "US Vallée", dateLabel: "Samedi", venue: "home", gameFormat: 8 }));

    expect(receivedIds).toEqual([educator.id]);
  });

  it("translates a validation failure into a 400 with the domain's message", async () => {
    const gateway: Pick<MatchGateway, "create"> = {
      create: async () => {
        throw new Error("Indique l’équipe adverse.");
      },
    };
    const handler = createCreateMatchHandler(authenticated, gateway, () => undefined);

    const response = await handler(jsonRequest("POST", { opponent: "", dateLabel: "Samedi", venue: "home", gameFormat: 8 }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Indique l’équipe adverse." });
  });
});

describe("createGetMatchHandler", () => {
  it("returns 404 when the match does not belong to the requesting educator", async () => {
    const gateway: Pick<MatchGateway, "get"> = {
      get: async () => {
        throw new MatchNotFoundError();
      },
    };
    const handler = createGetMatchHandler(authenticated, gateway, () => undefined);

    const response = await handler(new Request("https://evolyfoot.test/api/matches/match-1"), "match-1");

    expect(response.status).toBe(404);
  });
});

describe("createUpdateLineupHandler", () => {
  it("rejects a malformed lineup", async () => {
    const handler = createUpdateLineupHandler(authenticated, { updateLineup: async () => { throw new Error("not called"); } }, () => undefined);

    const response = await handler(jsonRequest("PUT", { lineup: [{ slotId: "goalkeeper-1" }], captainPlayerId: null }), "match-1");

    expect(response.status).toBe(400);
  });

  it("accepts a well-formed lineup and forwards it to the gateway", async () => {
    const received: unknown[] = [];
    const gateway: Pick<MatchGateway, "updateLineup"> = {
      updateLineup: async (educatorId, matchId, input) => {
        received.push({ educatorId, matchId, input });
        return match;
      },
    };
    const handler = createUpdateLineupHandler(authenticated, gateway, () => undefined);
    const lineup = [{ slotId: "goalkeeper-1", playerId: "p1", playerName: "Lina" }];

    const response = await handler(jsonRequest("PUT", { lineup, captainPlayerId: "p1" }), "match-1");

    expect(response.status).toBe(200);
    expect(received).toEqual([{ educatorId: educator.id, matchId: "match-1", input: { lineup, captainPlayerId: "p1" } }]);
  });

  it("forwards substitutePlayerIds when provided", async () => {
    const received: unknown[] = [];
    const gateway: Pick<MatchGateway, "updateLineup"> = {
      updateLineup: async (educatorId, matchId, input) => {
        received.push(input);
        return match;
      },
    };
    const handler = createUpdateLineupHandler(authenticated, gateway, () => undefined);

    const response = await handler(
      jsonRequest("PUT", { lineup: [], captainPlayerId: null, substitutePlayerIds: ["p2", "p3"] }),
      "match-1",
    );

    expect(response.status).toBe(200);
    expect(received).toEqual([{ lineup: [], captainPlayerId: null, substitutePlayerIds: ["p2", "p3"] }]);
  });

  it("rejects a malformed substitutePlayerIds", async () => {
    const handler = createUpdateLineupHandler(authenticated, { updateLineup: async () => { throw new Error("not called"); } }, () => undefined);

    const response = await handler(
      jsonRequest("PUT", { lineup: [], captainPlayerId: null, substitutePlayerIds: [42] }),
      "match-1",
    );

    expect(response.status).toBe(400);
  });
});

describe("createChangeFormationHandler", () => {
  it("rejects a request missing formationId", async () => {
    const handler = createChangeFormationHandler(authenticated, { changeFormation: async () => { throw new Error("not called"); } }, () => undefined);

    const response = await handler(jsonRequest("PUT", {}), "match-1");

    expect(response.status).toBe(400);
  });

  it("forwards the chosen formation to the gateway", async () => {
    const received: unknown[] = [];
    const gateway: Pick<MatchGateway, "changeFormation"> = {
      changeFormation: async (educatorId, matchId, formationId) => {
        received.push({ educatorId, matchId, formationId });
        return { ...match, formationId };
      },
    };
    const handler = createChangeFormationHandler(authenticated, gateway, () => undefined);

    const response = await handler(jsonRequest("PUT", { formationId: "2-3-2" }), "match-1");

    expect(response.status).toBe(200);
    expect(received).toEqual([{ educatorId: educator.id, matchId: "match-1", formationId: "2-3-2" }]);
  });

  it("translates a formation/format mismatch into a 400", async () => {
    const gateway: Pick<MatchGateway, "changeFormation"> = {
      changeFormation: async () => {
        throw new Error("Cette formation ne correspond pas au format de jeu.");
      },
    };
    const handler = createChangeFormationHandler(authenticated, gateway, () => undefined);

    const response = await handler(jsonRequest("PUT", { formationId: "4-3-3" }), "match-1");

    expect(response.status).toBe(400);
  });
});

describe("createMarkPlayedHandler", () => {
  it("translates an incomplete lineup into a 400", async () => {
    const gateway: Pick<MatchGateway, "markPlayed"> = {
      markPlayed: async () => {
        throw new Error("Complète la composition avant de valider.");
      },
    };
    const handler = createMarkPlayedHandler(authenticated, gateway, () => undefined);

    const response = await handler(new Request("https://evolyfoot.test/api/matches/match-1/played", { method: "POST" }), "match-1");

    expect(response.status).toBe(400);
  });

  it("marks a complete match as played", async () => {
    const gateway: Pick<MatchGateway, "markPlayed"> = { markPlayed: async () => ({ ...match, status: "played" }) };
    const handler = createMarkPlayedHandler(authenticated, gateway, () => undefined);

    const response = await handler(new Request("https://evolyfoot.test/api/matches/match-1/played", { method: "POST" }), "match-1");

    expect(response.status).toBe(200);
    expect((await response.json()).match.status).toBe("played");
  });
});

describe("createRemoveMatchHandler", () => {
  it("requires an authenticated session", async () => {
    const handler = createRemoveMatchHandler(anonymous, { remove: async () => { throw new Error("not called"); } }, () => undefined);

    const response = await handler(new Request("https://evolyfoot.test/api/matches/match-1", { method: "DELETE" }), "match-1");

    expect(response.status).toBe(401);
  });

  it("translates EducatorNotFoundError into a 401", async () => {
    const gateway: Pick<MatchGateway, "remove"> = {
      remove: async () => {
        throw new EducatorNotFoundError();
      },
    };
    const handler = createRemoveMatchHandler(authenticated, gateway, () => undefined);

    const response = await handler(new Request("https://evolyfoot.test/api/matches/match-1", { method: "DELETE" }), "match-1");

    expect(response.status).toBe(401);
  });
});
