import { PlayerEvaluationNotFoundError, PlayerNotFoundError, ValidationError } from "@evolyfoot/database";
import { createEmptyPlayerEvaluationScores } from "@evolyfoot/domain";
import { describe, expect, it } from "vitest";
import {
  createAddPlayerEvaluationHandler,
  createListPlayerEvaluationsHandler,
  createRemovePlayerEvaluationHandler,
  createUpdatePlayerEvaluationHandler,
  type PlayerEvaluationGateway,
  type PlayerEvaluationSummary,
} from "./player-evaluation";

const educator = { id: "educator-1", email: "coach@example.test", displayName: "Coach" };
const authenticated = async () => educator;
const anonymous = async () => null;
const scores = createEmptyPlayerEvaluationScores();
const summary: PlayerEvaluationSummary = {
  id: "eval-1",
  playerId: "player-1",
  scores,
  createdAt: "2026-09-10T00:00:00.000Z",
};

function request(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("createListPlayerEvaluationsHandler", () => {
  it("requires authentication", async () => {
    const handler = createListPlayerEvaluationsHandler(anonymous, { list: async () => [], listByPlayer: async () => [] }, () => undefined);
    expect((await handler(request("GET", "https://evolyfoot.test/api/player-evaluations"))).status).toBe(401);
  });

  it("lists all evaluations, or only a player's when playerId is given", async () => {
    const calls: string[] = [];
    const gateway: Pick<PlayerEvaluationGateway, "list" | "listByPlayer"> = {
      list: async () => {
        calls.push("all");
        return [summary];
      },
      listByPlayer: async (_id, playerId) => {
        calls.push(`player:${playerId}`);
        return [summary];
      },
    };
    const handler = createListPlayerEvaluationsHandler(authenticated, gateway, () => undefined);

    await handler(request("GET", "https://evolyfoot.test/api/player-evaluations"));
    await handler(request("GET", "https://evolyfoot.test/api/player-evaluations?playerId=player-1"));

    expect(calls).toEqual(["all", "player:player-1"]);
  });
});

describe("createAddPlayerEvaluationHandler", () => {
  it("rejects a body without a playerId or malformed scores", async () => {
    const handler = createAddPlayerEvaluationHandler(
      authenticated,
      { add: async () => { throw new Error("not called"); } },
      () => undefined,
    );
    expect((await handler(request("POST", "https://evolyfoot.test/api/player-evaluations", { scores }))).status).toBe(400);
    expect(
      (await handler(request("POST", "https://evolyfoot.test/api/player-evaluations", { playerId: "p1", scores: {} }))).status,
    ).toBe(400);
  });

  it("never trusts an educatorId from the body and returns 201 on success", async () => {
    const received: string[] = [];
    const handler = createAddPlayerEvaluationHandler(
      authenticated,
      {
        add: async (educatorId) => {
          received.push(educatorId);
          return summary;
        },
      },
      () => undefined,
    );

    const response = await handler(
      request("POST", "https://evolyfoot.test/api/player-evaluations", { playerId: "p1", scores, educatorId: "attacker" }),
    );

    expect(response.status).toBe(201);
    expect(received).toEqual([educator.id]);
  });

  it("maps the per-season cap (ValidationError) to a 400 and an unknown player to a 404", async () => {
    const capped = createAddPlayerEvaluationHandler(
      authenticated,
      { add: async () => { throw new ValidationError("Ce joueur a déjà 10 évaluations."); } },
      () => undefined,
    );
    expect((await capped(request("POST", "https://evolyfoot.test/api/player-evaluations", { playerId: "p1", scores }))).status).toBe(400);

    const missing = createAddPlayerEvaluationHandler(
      authenticated,
      { add: async () => { throw new PlayerNotFoundError(); } },
      () => undefined,
    );
    expect((await missing(request("POST", "https://evolyfoot.test/api/player-evaluations", { playerId: "p1", scores }))).status).toBe(404);
  });
});

describe("createUpdatePlayerEvaluationHandler", () => {
  it("requires authentication", async () => {
    const handler = createUpdatePlayerEvaluationHandler(anonymous, { update: async () => { throw new Error("not called"); } }, () => undefined);
    expect((await handler(request("PATCH", "https://evolyfoot.test/api/player-evaluations/eval-1", { scores }), "eval-1")).status).toBe(401);
  });

  it("rejects a body with neither scores nor date", async () => {
    const handler = createUpdatePlayerEvaluationHandler(authenticated, { update: async () => { throw new Error("not called"); } }, () => undefined);
    expect((await handler(request("PATCH", "https://evolyfoot.test/api/player-evaluations/eval-1", {}), "eval-1")).status).toBe(400);
  });

  it("forwards a scores-only or date-only update to the gateway", async () => {
    const received: unknown[] = [];
    const gateway: Pick<PlayerEvaluationGateway, "update"> = {
      update: async (educatorId, evaluationId, input) => {
        received.push({ educatorId, evaluationId, input });
        return summary;
      },
    };
    const handler = createUpdatePlayerEvaluationHandler(authenticated, gateway, () => undefined);

    const response = await handler(
      request("PATCH", "https://evolyfoot.test/api/player-evaluations/eval-1", { date: "2026-01-15T00:00:00.000Z" }),
      "eval-1",
    );
    expect(response.status).toBe(200);
    expect(received).toEqual([
      { educatorId: educator.id, evaluationId: "eval-1", input: { scores: undefined, date: "2026-01-15T00:00:00.000Z" } },
    ]);
  });

  it("maps an unknown evaluation to a 404", async () => {
    const handler = createUpdatePlayerEvaluationHandler(
      authenticated,
      { update: async () => { throw new PlayerEvaluationNotFoundError(); } },
      () => undefined,
    );
    expect((await handler(request("PATCH", "https://evolyfoot.test/api/player-evaluations/eval-1", { scores }), "eval-1")).status).toBe(404);
  });
});

describe("createRemovePlayerEvaluationHandler", () => {
  it("requires authentication and returns ok on success", async () => {
    const anon = createRemovePlayerEvaluationHandler(anonymous, { remove: async () => undefined }, () => undefined);
    expect((await anon(request("DELETE", "https://evolyfoot.test/api/player-evaluations/eval-1"), "eval-1")).status).toBe(401);

    const handler = createRemovePlayerEvaluationHandler(authenticated, { remove: async () => undefined }, () => undefined);
    expect((await handler(request("DELETE", "https://evolyfoot.test/api/player-evaluations/eval-1"), "eval-1")).status).toBe(200);
  });
});
