import { EducatorNotFoundError, MatchNotFoundError, TournamentNotFoundError, TrainingSessionNotFoundError, ValidationError } from "@evolyfoot/database";
import { describe, expect, it } from "vitest";
import {
  createCancelCompetitionHandler,
  createCancelMatchHandler,
  createCancelTrainingSessionHandler,
  createRestoreCompetitionHandler,
  createRestoreMatchHandler,
  createRestoreTrainingSessionHandler,
  createSendCompetitionConvocationHandler,
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
    const handler = createSendMatchConvocationHandler(
      anonymous,
      {
        sendForMatch: async () => {
          throw new Error("not called");
        },
      },
      () => undefined,
    );
    expect((await handler(request(), "match-1")).status).toBe(401);
  });

  it("forwards the coach id and returns the sent count", async () => {
    const received: unknown[] = [];
    const gateway: Pick<ConvocationGateway, "sendForMatch"> = {
      sendForMatch: async (educatorId, matchId) => {
        received.push({ educatorId, matchId });
        return { sentCount: 3, subject: "Convocation : match contre US Vallée", text: "Convocation : match…", recipients: [] };
      },
    };
    const handler = createSendMatchConvocationHandler(authenticated, gateway, () => undefined);
    const response = await handler(request(), "match-1");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sentCount: 3, emailCount: 0 });
    expect(received).toEqual([{ educatorId: educator.id, matchId: "match-1" }]);
  });

  it("maps an empty lineup to a 400", async () => {
    const handler = createSendMatchConvocationHandler(
      authenticated,
      {
        sendForMatch: async () => {
          throw new ValidationError("Compose l’équipe avant d’envoyer la convocation.");
        },
      },
      () => undefined,
    );
    expect((await handler(request(), "match-1")).status).toBe(400);
  });

  it("maps a match belonging to no one (or not this coach) to a 404", async () => {
    const handler = createSendMatchConvocationHandler(
      authenticated,
      {
        sendForMatch: async () => {
          throw new MatchNotFoundError();
        },
      },
      () => undefined,
    );
    expect((await handler(request(), "match-1")).status).toBe(404);
  });

  it("maps a missing educator to a 401", async () => {
    const handler = createSendMatchConvocationHandler(
      authenticated,
      {
        sendForMatch: async () => {
          throw new EducatorNotFoundError();
        },
      },
      () => undefined,
    );
    expect((await handler(request(), "match-1")).status).toBe(401);
  });
});

describe("createSendTrainingSessionConvocationHandler", () => {
  it("requires authentication", async () => {
    const handler = createSendTrainingSessionConvocationHandler(
      anonymous,
      {
        sendForTrainingSession: async () => {
          throw new Error("not called");
        },
      },
      () => undefined,
    );
    expect((await handler(request(), "session-1")).status).toBe(401);
  });

  it("forwards the coach id and returns the sent count", async () => {
    const received: unknown[] = [];
    const gateway: Pick<ConvocationGateway, "sendForTrainingSession"> = {
      sendForTrainingSession: async (educatorId, sessionId) => {
        received.push({ educatorId, sessionId });
        return { sentCount: 14, subject: "Convocation : séance", text: "Convocation : séance…", recipients: [] };
      },
    };
    const handler = createSendTrainingSessionConvocationHandler(authenticated, gateway, () => undefined);
    const response = await handler(request(), "session-1");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sentCount: 14, emailCount: 0 });
    expect(received).toEqual([{ educatorId: educator.id, sessionId: "session-1" }]);
  });

  it("maps a session belonging to no one (or not this coach) to a 404", async () => {
    const handler = createSendTrainingSessionConvocationHandler(
      authenticated,
      {
        sendForTrainingSession: async () => {
          throw new TrainingSessionNotFoundError();
        },
      },
      () => undefined,
    );
    expect((await handler(request(), "session-1")).status).toBe(404);
  });

  it("sends an e-mail reminder to every known address and counts them", async () => {
    const mails: Array<{ to: string; subject: string; text: string }> = [];
    const handler = createSendTrainingSessionConvocationHandler(
      authenticated,
      {
        sendForTrainingSession: async () => ({
          sentCount: 14,
          subject: "Convocation : séance « Récupérer »",
          text: "Convocation : séance « Récupérer », mardi · 18:00 — Stade.",
          recipients: [
            { email: "parent@example.test", name: "Kylian" },
            { email: "tuteur@example.test", name: "Tuteur de Nael" },
          ],
        }),
      },
      () => undefined,
      { send: async (input) => void mails.push(input), calendarUrl: () => "https://evolyfoot.test/joueur/calendrier" },
    );
    const response = await handler(request(), "session-1");
    expect(await response.json()).toEqual({ sentCount: 14, emailCount: 2 });
    expect(mails.map((mail) => mail.to)).toEqual(["parent@example.test", "tuteur@example.test"]);
    expect(mails[0]!.subject).toBe("Convocation : séance « Récupérer » — EvolyFoot");
    expect(mails[0]!.text).toContain("Bonjour Kylian");
    expect(mails[0]!.text).toContain("Coach t’envoie une convocation");
    expect(mails[0]!.text).toContain("https://evolyfoot.test/joueur/calendrier");
  });
});

describe("createSendCompetitionConvocationHandler", () => {
  it("forwards the kind and the id, then maps a missing tournament to 404", async () => {
    const received: unknown[] = [];
    const gateway: Pick<ConvocationGateway, "sendForCompetition"> = {
      sendForCompetition: async (educatorId, kind, competitionId) => {
        received.push({ educatorId, kind, competitionId });
        if (competitionId === "absent") throw new TournamentNotFoundError();
        return { sentCount: 2, subject: "Convocation : tournoi « Noël »", text: "Convocation…", recipients: [] };
      },
    };
    const handler = createSendCompetitionConvocationHandler("tournament", authenticated, gateway, () => undefined);
    const response = await handler(request(), "t1");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sentCount: 2, emailCount: 0 });
    expect(received).toEqual([{ educatorId: educator.id, kind: "tournament", competitionId: "t1" }]);
    expect((await handler(request(), "absent")).status).toBe(404);
    expect((await createSendCompetitionConvocationHandler("plateau", anonymous, gateway, () => undefined)(request(), "p1")).status).toBe(401);
  });
});

describe("relance des joueurs sans réponse", () => {
  function withBody(body: unknown): Request {
    return new Request("https://evolyfoot.test/api/matches/match-1/convoke", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });
  }

  it("transmet onlyPending à la convocation d'un match et d'un tournoi, sans corps ou avec un corps invalide : tous", async () => {
    const options: unknown[] = [];
    const outcome = { sentCount: 1, subject: "s", text: "t", recipients: [] };
    const gateway: Pick<ConvocationGateway, "sendForMatch" | "sendForCompetition"> = {
      sendForMatch: async (_educatorId, _matchId, received) => {
        options.push(received);
        return outcome;
      },
      sendForCompetition: async (_educatorId, _kind, _id, received) => {
        options.push(received);
        return outcome;
      },
    };
    const match = createSendMatchConvocationHandler(authenticated, gateway, () => undefined);
    const tournament = createSendCompetitionConvocationHandler("tournament", authenticated, gateway, () => undefined);

    await match(withBody({ onlyPending: true }), "match-1");
    await match(request(), "match-1");
    await match(withBody("pas du json"), "match-1");
    await tournament(withBody({ onlyPending: true }), "tournament-1");

    expect(options).toEqual([{ onlyPending: true }, {}, {}, { onlyPending: true }]);
  });
});

describe("annulation d'un entraînement", () => {
  const cancelRequest = (body: unknown) =>
    new Request("https://evolyfoot.test/api/sessions/session-1/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("exige une session", async () => {
    const handler = createCancelTrainingSessionHandler(
      anonymous,
      { cancelTrainingSession: async () => Promise.reject(new Error("non appelé")) },
      () => undefined,
    );
    expect((await handler(cancelRequest({}), "session-1")).status).toBe(401);
  });

  it("transmet la raison, prévient par e-mail et renvoie le nombre de joueurs prévenus", async () => {
    const received: unknown[] = [];
    const sent: unknown[] = [];
    const handler = createCancelTrainingSessionHandler(
      authenticated,
      {
        cancelTrainingSession: async (educatorId, sessionId, note) => {
          received.push([educatorId, sessionId, note]);
          return { sentCount: 2, subject: "Annulation : entraînement", text: "Annulation : …", recipients: [{ email: "parent@example.test", name: "Parent" }] };
        },
      },
      () => undefined,
      { send: async (input) => void sent.push(input), calendarUrl: () => "https://evolyfoot.test/joueur/calendrier" },
    );

    const response = await handler(cancelRequest({ note: "Terrain impraticable." }), "session-1");

    expect(await response.json()).toEqual({ sentCount: 2, emailCount: 1 });
    expect(received).toEqual([["educator-1", "session-1", "Terrain impraticable."]]);
    expect(sent).toHaveLength(1);
  });

  it("accepte une annulation sans corps et traduit les erreurs", async () => {
    const received: unknown[] = [];
    const ok = createCancelTrainingSessionHandler(
      authenticated,
      { cancelTrainingSession: async (_educatorId, _sessionId, note) => (received.push(note), { sentCount: 0, subject: "", text: "", recipients: [] }) },
      () => undefined,
    );
    expect((await ok(new Request("https://evolyfoot.test/x", { method: "POST" }), "session-1")).status).toBe(200);
    expect(received).toEqual([null]);

    const failing = (error: unknown) =>
      createCancelTrainingSessionHandler(authenticated, { cancelTrainingSession: async () => Promise.reject(error) }, () => undefined);
    expect((await failing(new ValidationError("Cet entraînement est déjà annulé."))(cancelRequest({}), "session-1")).status).toBe(400);
    expect((await failing(new TrainingSessionNotFoundError())(cancelRequest({}), "session-1")).status).toBe(404);
  });

  it("rétablit l'entraînement sans message", async () => {
    const received: unknown[] = [];
    const handler = createRestoreTrainingSessionHandler(
      authenticated,
      { restoreTrainingSession: async (...args) => void received.push(args) },
      () => undefined,
    );
    const response = await handler(new Request("https://evolyfoot.test/x", { method: "DELETE" }), "session-1");
    expect(await response.json()).toEqual({ restored: true });
    expect(received).toEqual([["educator-1", "session-1"]]);
  });
});

describe("annulation d'un match, d'un tournoi et d'un plateau", () => {
  const post = (body?: unknown) =>
    new Request("https://evolyfoot.test/x/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const outcome = { sentCount: 3, subject: "Annulation", text: "Annulation : …", recipients: [] };

  it("annule un match : session exigée, raison transmise, joueurs prévenus", async () => {
    const received: unknown[] = [];
    const gateway = { cancelMatch: async (...args: unknown[]) => (received.push(args), outcome) };
    expect((await createCancelMatchHandler(anonymous, gateway, () => undefined)(post({}), "match-1")).status).toBe(401);
    const response = await createCancelMatchHandler(authenticated, gateway, () => undefined)(post({ note: "Terrain gelé." }), "match-1");
    expect(await response.json()).toEqual({ sentCount: 3, emailCount: 0 });
    expect(received).toEqual([["educator-1", "match-1", "Terrain gelé."]]);
    const failing = createCancelMatchHandler(authenticated, { cancelMatch: async () => Promise.reject(new MatchNotFoundError()) }, () => undefined);
    expect((await failing(post(), "match-1")).status).toBe(404);
  });

  it("annule un tournoi ou un plateau selon le type de la route, et les rétablit", async () => {
    const received: unknown[] = [];
    const gateway = { cancelCompetition: async (...args: unknown[]) => (received.push(args), outcome) };
    await createCancelCompetitionHandler("plateau", authenticated, gateway, () => undefined)(post({ note: "Pluie." }), "p-1");
    await createCancelCompetitionHandler("tournament", authenticated, gateway, () => undefined)(post(), "t-1");
    expect(received).toEqual([
      ["educator-1", "plateau", "p-1", "Pluie."],
      ["educator-1", "tournament", "t-1", null],
    ]);

    const restored: unknown[] = [];
    const restoreGateway = {
      restoreMatch: async (...args: unknown[]) => void restored.push(["match", ...args]),
      restoreCompetition: async (...args: unknown[]) => void restored.push(["competition", ...args]),
    };
    const del = new Request("https://evolyfoot.test/x/cancel", { method: "DELETE" });
    expect((await createRestoreMatchHandler(authenticated, restoreGateway, () => undefined)(del, "match-1")).status).toBe(200);
    expect((await createRestoreCompetitionHandler("tournament", authenticated, restoreGateway, () => undefined)(del, "t-1")).status).toBe(200);
    expect(restored).toEqual([
      ["match", "educator-1", "match-1"],
      ["competition", "educator-1", "tournament", "t-1"],
    ]);
  });
});
