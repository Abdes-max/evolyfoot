import { ClubNotFoundError, type ClubRecord } from "@evolyfoot/database";
import { describe, expect, it } from "vitest";
import type { PublicAccount } from "./auth";
import { createCreateOrJoinClubHandler, createGetClubHandler, createListClubExercisesHandler } from "./club";

const coach: PublicAccount = { id: "compte-1", email: "coach@example.test", displayName: "Coach", role: "coach", linkedPlayerId: null, emailVerified: true };
const club: ClubRecord = { id: "club-1", name: "US Exemple", joinCode: "ABCD2345", members: [{ id: "compte-1", displayName: "Coach" }] };
const ignore = () => undefined;

function post(body: unknown): Request {
  return new Request("https://evolyfoot.test/api/club", { method: "POST", body: JSON.stringify(body) });
}

describe("handlers du club", () => {
  it("exige une session et refuse un adjoint", async () => {
    const request = new Request("https://evolyfoot.test/api/club");
    expect((await createGetClubHandler(async () => null, { get: async () => club }, ignore)(request)).status).toBe(401);
    expect((await createGetClubHandler(async () => ({ ...coach, role: "assistant" }), { get: async () => club }, ignore)(request)).status).toBe(403);
  });

  it("crée un club avec un nom et en rejoint un avec un code", async () => {
    const calls: string[] = [];
    const handler = createCreateOrJoinClubHandler(
      async () => coach,
      {
        create: async (_id, name) => {
          calls.push(`create:${name}`);
          return club;
        },
        join: async (_id, code) => {
          calls.push(`join:${code}`);
          return club;
        },
      },
      ignore,
    );

    expect((await handler(post({ name: "US Exemple" }))).status).toBe(201);
    expect((await handler(post({ code: "abcd2345" }))).status).toBe(200);
    expect((await handler(post({}))).status).toBe(400);
    expect(calls).toEqual(["create:US Exemple", "join:abcd2345"]);
  });

  it("répond 404 pour un code inconnu", async () => {
    const handler = createCreateOrJoinClubHandler(
      async () => coach,
      {
        create: async () => club,
        join: async () => {
          throw new ClubNotFoundError();
        },
      },
      ignore,
    );
    const response = await handler(post({ code: "ZZZZ9999" }));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Aucun club ne correspond à ce code." });
  });

  it("liste les exercices partagés", async () => {
    const handler = createListClubExercisesHandler(async () => coach, { sharedExercises: async () => [] }, ignore);
    expect(await (await handler(new Request("https://evolyfoot.test/api/club/exercises"))).json()).toEqual({ exercises: [] });
  });
});
