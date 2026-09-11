import { EducatorNotFoundError, PlayerNotFoundError } from "@evolyfoot/database";
import { describe, expect, it } from "vitest";
import {
  createAddPlayerHandler,
  createListRosterHandler,
  createRemovePlayerHandler,
  createUpdatePlayerHandler,
  type RosterGateway,
  type RosterPlayer,
} from "./roster";

const educator = { id: "educator-1", email: "coach@example.test", displayName: "Coach" };
const player: RosterPlayer = {
  id: "player-1",
  firstName: "Kylian",
  lastName: "Test",
  name: "Kylian Test",
  photo: null,
  birthDate: null,
  phone: null,
  email: null,
};

function jsonRequest(method: string, body?: unknown): Request {
  return new Request("https://evolyfoot.test/api/roster", {
    method,
    headers: { "content-type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const authenticated = async () => educator;
const anonymous = async () => null;

describe("createListRosterHandler", () => {
  it("requires an authenticated session", async () => {
    const handler = createListRosterHandler(anonymous, { list: async () => { throw new Error("not called"); } }, () => undefined);

    const response = await handler(new Request("https://evolyfoot.test/api/roster"));

    expect(response.status).toBe(401);
  });

  it("returns the educator's roster", async () => {
    const handler = createListRosterHandler(authenticated, { list: async () => [player] }, () => undefined);

    const response = await handler(new Request("https://evolyfoot.test/api/roster"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ players: [player] });
  });
});

describe("createAddPlayerHandler", () => {
  it("requires an authenticated session before reading the body", async () => {
    const handler = createAddPlayerHandler(anonymous, { add: async () => { throw new Error("not called"); } }, () => undefined);

    const response = await handler(jsonRequest("POST", { firstName: "Kylian", lastName: "Test" }));

    expect(response.status).toBe(401);
  });

  it("never trusts an educatorId supplied in the request body", async () => {
    const receivedIds: string[] = [];
    const gateway: Pick<RosterGateway, "add"> = {
      add: async (educatorId) => {
        receivedIds.push(educatorId);
        return player;
      },
    };
    const handler = createAddPlayerHandler(authenticated, gateway, () => undefined);

    await handler(jsonRequest("POST", { firstName: "Kylian", lastName: "Test", educatorId: "attacker-supplied-id" }));

    expect(receivedIds).toEqual([educator.id]);
  });

  it("rejects a missing first or last name without calling the gateway", async () => {
    const handler = createAddPlayerHandler(authenticated, { add: async () => { throw new Error("not called"); } }, () => undefined);

    expect((await handler(jsonRequest("POST", {}))).status).toBe(400);
    expect((await handler(jsonRequest("POST", { firstName: "Kylian" }))).status).toBe(400);
    expect((await handler(jsonRequest("POST", { lastName: "Test" }))).status).toBe(400);
  });

  it("maps a domain validation failure to a 400 with its message", async () => {
    const gateway: Pick<RosterGateway, "add"> = {
      add: async () => {
        throw new Error("Indique un prénom.");
      },
    };
    const handler = createAddPlayerHandler(authenticated, gateway, () => undefined);

    const response = await handler(jsonRequest("POST", { firstName: "   ", lastName: "Test" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Indique un prénom.");
  });

  it("maps a missing educator to a 401", async () => {
    const gateway: Pick<RosterGateway, "add"> = {
      add: async () => {
        throw new EducatorNotFoundError();
      },
    };
    const handler = createAddPlayerHandler(authenticated, gateway, () => undefined);

    const response = await handler(jsonRequest("POST", { firstName: "Kylian", lastName: "Test" }));

    expect(response.status).toBe(401);
  });

  it("adds and returns the player on success", async () => {
    const received: unknown[] = [];
    const handler = createAddPlayerHandler(
      authenticated,
      { add: async (educatorId, firstName, lastName) => { received.push({ educatorId, firstName, lastName }); return player; } },
      () => undefined,
    );

    const response = await handler(jsonRequest("POST", { firstName: "Kylian", lastName: "Test" }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ player });
    expect(received).toEqual([{ educatorId: educator.id, firstName: "Kylian", lastName: "Test" }]);
  });
});

describe("createUpdatePlayerHandler", () => {
  it("requires an authenticated session", async () => {
    const handler = createUpdatePlayerHandler(anonymous, { update: async () => { throw new Error("not called"); } }, () => undefined);

    const response = await handler(jsonRequest("PATCH", { firstName: "Mbappé" }), player.id);

    expect(response.status).toBe(401);
  });

  it("maps a player belonging to another educator to a 404", async () => {
    const gateway: Pick<RosterGateway, "update"> = {
      update: async () => {
        throw new PlayerNotFoundError();
      },
    };
    const handler = createUpdatePlayerHandler(authenticated, gateway, () => undefined);

    const response = await handler(jsonRequest("PATCH", { firstName: "Mbappé" }), player.id);

    expect(response.status).toBe(404);
  });

  it("forwards only known fields and rejects an empty patch", async () => {
    const received: unknown[] = [];
    const gateway: Pick<RosterGateway, "update"> = {
      update: async (_id, _playerId, input) => {
        received.push(input);
        return player;
      },
    };
    const handler = createUpdatePlayerHandler(authenticated, gateway, () => undefined);

    await handler(jsonRequest("PATCH", { firstName: "Mbappé", lastName: "Roi", phone: "0102", nope: "x", email: null }), player.id);
    expect(received).toEqual([{ firstName: "Mbappé", lastName: "Roi", phone: "0102", email: null }]);

    expect((await handler(jsonRequest("PATCH", { nope: "x" }), player.id)).status).toBe(400);
  });

  it("updates and returns the player on success", async () => {
    const updated: RosterPlayer = { ...player, firstName: "Mbappé", name: "Mbappé Test" };
    const handler = createUpdatePlayerHandler(authenticated, { update: async () => updated }, () => undefined);

    const response = await handler(jsonRequest("PATCH", { firstName: "Mbappé" }), player.id);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ player: updated });
  });
});

describe("createRemovePlayerHandler", () => {
  it("requires an authenticated session", async () => {
    const handler = createRemovePlayerHandler(anonymous, { remove: async () => { throw new Error("not called"); } }, () => undefined);

    const response = await handler(jsonRequest("DELETE"), player.id);

    expect(response.status).toBe(401);
  });

  it("maps a player belonging to another educator to a 404", async () => {
    const gateway: Pick<RosterGateway, "remove"> = {
      remove: async () => {
        throw new PlayerNotFoundError();
      },
    };
    const handler = createRemovePlayerHandler(authenticated, gateway, () => undefined);

    const response = await handler(jsonRequest("DELETE"), player.id);

    expect(response.status).toBe(404);
  });

  it("removes the player on success", async () => {
    const handler = createRemovePlayerHandler(authenticated, { remove: async () => undefined }, () => undefined);

    const response = await handler(jsonRequest("DELETE"), player.id);

    expect(response.status).toBe(200);
  });
});
