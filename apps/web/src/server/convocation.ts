import { EducatorNotFoundError, MatchNotFoundError, TrainingSessionNotFoundError, ValidationError } from "@evolyfoot/database";
import type { PublicEducator } from "./auth";
import type { MailInput } from "./mailer";
import { renderConvocationEmail, sendMail } from "./mailer";
import { resolveOrigin } from "./request-origin";

export interface ConvocationOutcome {
  sentCount: number;
  subject: string;
  text: string;
  recipients: Array<{ email: string; name: string }>;
}

export interface ConvocationGateway {
  sendForMatch(educatorId: string, matchId: string): Promise<ConvocationOutcome>;
  sendForTrainingSession(educatorId: string, sessionId: string): Promise<ConvocationOutcome>;
}

export interface ConvocationMailer {
  send: (input: MailInput) => Promise<void>;
  // Lien de l'onglet Calendrier d'EvolyFoot Player, où répondre présent ou absent.
  calendarUrl: (request: Request) => string;
}

export const convocationMailer: ConvocationMailer = {
  send: (input) => sendMail(input),
  calendarUrl: (request) => `${resolveOrigin(request)}/joueur/calendrier`,
};

// La convocation part d'abord dans la messagerie ; l'e-mail n'est qu'un rappel, envoyé aux
// adresses connues. Un envoi raté est journalisé par `sendMail` sans faire échouer la convocation.
async function notifyByEmail(outcome: ConvocationOutcome, coachName: string, request: Request, mailer: ConvocationMailer | undefined): Promise<number> {
  if (!mailer || outcome.recipients.length === 0) {
    return 0;
  }
  const url = mailer.calendarUrl(request);
  await Promise.all(
    outcome.recipients.map((recipient) =>
      mailer.send({ to: recipient.email, ...renderConvocationEmail(recipient.name, coachName, outcome.subject, outcome.text, url) }),
    ),
  );
  return outcome.recipients.length;
}

function errorResponse(error: unknown, log: (error: unknown) => void): Response {
  if (error instanceof MatchNotFoundError || error instanceof TrainingSessionNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof EducatorNotFoundError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  log(error);
  return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
}

// Envoie la convocation (via la messagerie, voir ConvocationService côté base) pour un match --
// à la composition retenue -- ou une séance -- à tout l'effectif, celle-ci n'ayant pas de
// composition.
export function createSendMatchConvocationHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  convocation: Pick<ConvocationGateway, "sendForMatch">,
  log: (error: unknown) => void,
  mailer?: ConvocationMailer,
): (request: Request, matchId: string) => Promise<Response> {
  return async (request, matchId) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    try {
      const outcome = await convocation.sendForMatch(educator.id, matchId);
      return Response.json({ sentCount: outcome.sentCount, emailCount: await notifyByEmail(outcome, educator.displayName, request, mailer) });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createSendTrainingSessionConvocationHandler(
  resolveEducator: (request: Request) => Promise<PublicEducator | null>,
  convocation: Pick<ConvocationGateway, "sendForTrainingSession">,
  log: (error: unknown) => void,
  mailer?: ConvocationMailer,
): (request: Request, sessionId: string) => Promise<Response> {
  return async (request, sessionId) => {
    const educator = await resolveEducator(request);
    if (!educator) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    try {
      const outcome = await convocation.sendForTrainingSession(educator.id, sessionId);
      return Response.json({ sentCount: outcome.sentCount, emailCount: await notifyByEmail(outcome, educator.displayName, request, mailer) });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export async function createConvocationGateway(): Promise<{ gateway: ConvocationGateway; disconnect: () => Promise<void> }> {
  const {
    createDatabaseClient,
    ConvocationService,
    PrismaEducatorRepository,
    PrismaMatchRepository,
    PrismaMessageRepository,
    PrismaPlayerRepository,
    PrismaTrainingSessionRepository,
    NotifyingMessageRepository,
  } = await import("@evolyfoot/database");
  const { notificationServiceFor } = await import("./notifications");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const service = new ConvocationService(
    new PrismaEducatorRepository(database.prisma),
    new PrismaPlayerRepository(database.prisma),
    new PrismaMatchRepository(database.prisma),
    new PrismaTrainingSessionRepository(database.prisma),
    new NotifyingMessageRepository(new PrismaMessageRepository(database.prisma), await notificationServiceFor(database), console.error),
  );

  return {
    gateway: {
      sendForMatch: (educatorId, matchId) => service.sendForMatch(educatorId, matchId),
      sendForTrainingSession: (educatorId, sessionId) => service.sendForTrainingSession(educatorId, sessionId),
    },
    disconnect: database.disconnect,
  };
}
