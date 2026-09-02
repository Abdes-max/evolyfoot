import { EducatorNotFoundError, PlayerNotFoundError } from "@evolyfoot/database";
import { describe, expect, it } from "vitest";
import {
  createAddPlayerHandler,
  createListRosterHandler,
  createRemovePlayerHandler,
  createRenamePlayerHandler,
  type RosterGateway,
} from "./roster";

const educator = { id: "educator-1", email: "coach@example.test", displayName: "Coach" };
const player = { id: "player-1", name: "Kylian" };

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

    const response = await handler(jsonRequest("POST", { name: "Kylian" }));

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

    await handler(jsonRequest("POST", { name: "Kylian", educatorId: "attacker-supplied-id" }));

    expect(receivedIds).toEqual([educator.id]);
  });

  it("rejects a missing name without calling the gateway", async () => {
    const handler = createAddPlayerHandler(authenticated, { add: async () => { throw new Error("not called"); } }, () => undefined);

    const response = await handler(jsonRequest("POST", {}));

    expect(response.status).toBe(400);
  });

  it("maps a domain validation failure to a 400 with its message", async () => {
    const gateway: Pick<RosterGateway, "add"> = {
      add: async () => {
        throw new Error("Indique un prénom.");
      },
    };
    const handler = createAddPlayerHandler(authenticated, gateway, () => undefined);

    const response = await handler(jsonRequest("POST", { name: "   " }));
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

    const response = await handler(jsonRequest("POST", { name: "Kylian" }));

    expect(response.status).toBe(401);
  });

  it("adds and returns the player on success", async () => {
    const handler = createAddPlayerHandler(authenticated, { add: async () => player }, () => undefined);

    const response = await handler(jsonRequest("POST", { name: "Kylian" }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ player });
  });
});

describe("createRenamePlayerHandler", () => {
  it("requires an authenticated session", async () => {
    const handler = createRenamePlayerHandler(anonymous, { rename: async () => { throw new Error("not called"); } }, () => undefined);

    const response = await handler(jsonRequest("PATCH", { name: "Mbappé" }), player.id);

    expect(response.status).toBe(401);
  });

  it("maps a player belonging to another educator to a 404", async () => {
    const gateway: Pick<RosterGateway, "rename"> = {
      rename: async () => {
        throw new PlayerNotFoundError();
      },
    };
    const handler = createRenamePlayerHandler(authenticated, gateway, () => undefined);

    const response = await handler(jsonRequest("PATCH", { name: "Mbappé" }), player.id);

    expect(response.status).toBe(404);
  });

  it("renames and returns the player on success", async () => {
    const renamed = { id: player.id, name: "Mbappé" };
    const handler = createRenamePlayerHandler(authenticated, { rename: async () => renamed }, () => undefined);

    const response = await handler(jsonRequest("PATCH", { name: "Mbappé" }), player.id);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ player: renamed });
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
