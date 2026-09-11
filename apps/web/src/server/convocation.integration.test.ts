import { EducatorNotFoundError, MatchNotFoundError, TrainingSessionNotFoundError, ValidationError } from "@evolyfoot/database";
import { describe, expect, it } from "vitest";
import {
  createSendMatchConvocationHandler,
  createSendTrainingSessionConvocationHandler,
  type ConvocationGateway,
} from "./convocation";

const educator = { id: "educator-1", email: "coach@example.test", displayName: "Coach" };
const authenticated = async () => educator;
const anonymous = async () => null;

function request(): Request {
  return new Request("https://evolyfoot.test/api/matches/match-1/convoke", { method: "POST" });
}

describe("createSendMatchConvocationHandler", () => {
  it("requires authentication", async () => {
    const handler = createSendMatchConvocationHandler(anonymous, { sendForMatch: async () => { throw new Error("not called"); } }, () => undefined);
    expect((await handler(request(), "match-1")).status).toBe(401);
  });

  it("forwards the coach id and returns the sent count", async () => {
    const received: unknown[] = [];
    const gateway: Pick<ConvocationGateway, "sendForMatch"> = {
      sendForMatch: async (educatorId, matchId) => {
        received.push({ educatorId, matchId });
        return { sentCount: 3 };
      },
    };
    const handler = createSendMatchConvocationHandler(authenticated, gateway, () => undefined);
    const response = await handler(request(), "match-1");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sentCount: 3 });
    expect(received).toEqual([{ educatorId: educator.id, matchId: "match-1" }]);
  });

  it("maps an empty lineup to a 400", async () => {
    const handler = createSendMatchConvocationHandler(
      authenticated,
      { sendForMatch: async () => { throw new ValidationError("Compose l’équipe avant d’envoyer la convocation."); } },
      () => undefined,
    );
    expect((await handler(request(), "match-1")).status).toBe(400);
  });

  it("maps a match belonging to no one (or not this coach) to a 404", async () => {
    const handler = createSendMatchConvocationHandler(authenticated, { sendForMatch: async () => { throw new MatchNotFoundError(); } }, () => undefined);
    expect((await handler(request(), "match-1")).status).toBe(404);
  });

  it("maps a missing educator to a 401", async () => {
    const handler = createSendMatchConvocationHandler(
      authenticated,
      { sendForMatch: async () => { throw new EducatorNotFoundError(); } },
      () => undefined,
    );
    expect((await handler(request(), "match-1")).status).toBe(401);
  });
});

describe("createSendTrainingSessionConvocationHandler", () => {
  it("requires authentication", async () => {
    const handler = createSendTrainingSessionConvocationHandler(
      anonymous,
      { sendForTrainingSession: async () => { throw new Error("not called"); } },
      () => undefined,
    );
    expect((await handler(request(), "session-1")).status).toBe(401);
  });

  it("forwards the coach id and returns the sent count", async () => {
    const received: unknown[] = [];
    const gateway: Pick<ConvocationGateway, "sendForTrainingSession"> = {
      sendForTrainingSession: async (educatorId, sessionId) => {
        received.push({ educatorId, sessionId });
        return { sentCount: 14 };
      },
    };
    const handler = createSendTrainingSessionConvocationHandler(authenticated, gateway, () => undefined);
    const response = await handler(request(), "session-1");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sentCount: 14 });
    expect(received).toEqual([{ educatorId: educator.id, sessionId: "session-1" }]);
  });

  it("maps a session belonging to no one (or not this coach) to a 404", async () => {
    const handler = createSendTrainingSessionConvocationHandler(
      authenticated,
      { sendForTrainingSession: async () => { throw new TrainingSessionNotFoundError(); } },
      () => undefined,
    );
    expect((await handler(request(), "session-1")).status).toBe(404);
  });
});
