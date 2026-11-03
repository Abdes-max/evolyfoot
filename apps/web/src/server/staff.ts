import { DuplicateEducatorEmailError, EducatorNotFoundError, InviteInvalidError, ValidationError } from "@evolyfoot/database";
import { buildSessionCookie, type PublicAccount } from "./auth";

export interface StaffMemberSummary {
  id: string;
  displayName: string;
  email: string;
  createdAt: string;
}

export interface StaffGateway {
  list(ownerId: string): Promise<StaffMemberSummary[]>;
  invite(ownerId: string): Promise<{ token: string; expiresAt: string }>;
  preview(token: string): Promise<{ coachName: string; teamName: string | null }>;
  join(
    token: string,
    input: { email: string; password: string; displayName: string },
  ): Promise<{ account: PublicAccount; sessionToken: string; expiresAt: Date }>;
  remove(ownerId: string, memberId: string): Promise<void>;
}

type ResolveAccount = (request: Request) => Promise<PublicAccount | null>;

function errorResponse(error: unknown, log: (error: unknown) => void): Response {
  if (error instanceof InviteInvalidError) {
    return Response.json({ error: error.message }, { status: 410 });
  }
  if (error instanceof DuplicateEducatorEmailError) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof EducatorNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  log(error);
  return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
}

// Gérer le staff est réservé au titulaire de l'équipe : un adjoint n'invite ni ne retire personne.
async function requireOwner(resolveAccount: ResolveAccount, request: Request): Promise<PublicAccount | Response> {
  const account = await resolveAccount(request);
  if (!account) {
    return Response.json({ error: "Authentification requise." }, { status: 401 });
  }
  if (account.role !== "coach") {
    return Response.json({ error: "Accès réservé à l’éducateur de l’équipe." }, { status: 403 });
  }
  return account;
}

export function createListStaffHandler(resolveAccount: ResolveAccount, staff: Pick<StaffGateway, "list">, log: (error: unknown) => void) {
  return async (request: Request): Promise<Response> => {
    const owner = await requireOwner(resolveAccount, request);
    if (owner instanceof Response) {
      return owner;
    }
    try {
      return Response.json({ members: await staff.list(owner.id) });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createInviteStaffHandler(
  resolveAccount: ResolveAccount,
  staff: Pick<StaffGateway, "invite">,
  origin: (request: Request) => string,
  log: (error: unknown) => void,
) {
  return async (request: Request): Promise<Response> => {
    const owner = await requireOwner(resolveAccount, request);
    if (owner instanceof Response) {
      return owner;
    }
    try {
      const { token, expiresAt } = await staff.invite(owner.id);
      return Response.json({ url: `${origin(request)}/rejoindre/staff/${token}`, expiresAt }, { status: 201 });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createPreviewStaffInviteHandler(staff: Pick<StaffGateway, "preview">, log: (error: unknown) => void) {
  return async (token: string): Promise<Response> => {
    try {
      return Response.json({ invite: await staff.preview(token) });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createJoinStaffHandler(staff: Pick<StaffGateway, "join">, log: (error: unknown) => void) {
  return async (request: Request): Promise<Response> => {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const { token, email, password, displayName } = body ?? {};
    if (
      typeof token !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      typeof displayName !== "string" ||
      !token ||
      !email ||
      !password ||
      !displayName
    ) {
      return Response.json({ error: "Tous les champs sont requis." }, { status: 400 });
    }
    try {
      const { account, sessionToken, expiresAt } = await staff.join(token, { email, password, displayName });
      const response = Response.json({ account }, { status: 201 });
      response.headers.append("Set-Cookie", buildSessionCookie(sessionToken, expiresAt));
      return response;
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export function createRemoveStaffHandler(resolveAccount: ResolveAccount, staff: Pick<StaffGateway, "remove">, log: (error: unknown) => void) {
  return async (request: Request, memberId: string): Promise<Response> => {
    const owner = await requireOwner(resolveAccount, request);
    if (owner instanceof Response) {
      return owner;
    }
    try {
      await staff.remove(owner.id, memberId);
      return Response.json({ status: "ok" });
    } catch (error) {
      return errorResponse(error, log);
    }
  };
}

export async function createStaffGateway(): Promise<{ gateway: StaffGateway; disconnect: () => Promise<void> }> {
  const { createDatabaseClient, AuthService, StaffService, PrismaEducatorRepository, PrismaSessionRepository, PrismaStaffRepository, PrismaTeamRepository } =
    await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const educators = new PrismaEducatorRepository(database.prisma);
  const service = new StaffService(
    educators,
    new PrismaStaffRepository(database.prisma),
    new PrismaTeamRepository(database.prisma),
    new AuthService(educators, new PrismaSessionRepository(database.prisma)),
  );

  return {
    gateway: {
      async list(ownerId) {
        const members = await service.list(ownerId);
        return members.map((member) => ({ ...member, createdAt: member.createdAt.toISOString() }));
      },
      async invite(ownerId) {
        const invite = await service.invite(ownerId);
        return { token: invite.token, expiresAt: invite.expiresAt.toISOString() };
      },
      preview: (token) => service.preview(token),
      async join(token, input) {
        const session = await service.join(token, input);
        return {
          account: {
            id: session.educator.id,
            email: session.educator.email,
            displayName: session.educator.displayName,
            role: "assistant",
            linkedPlayerId: null,
            emailVerified: true,
          },
          sessionToken: session.sessionToken,
          expiresAt: session.expiresAt,
        };
      },
      remove: (ownerId, memberId) => service.remove(ownerId, memberId),
    },
    disconnect: database.disconnect,
  };
}
