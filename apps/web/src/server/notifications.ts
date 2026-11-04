import { ValidationError } from "@evolyfoot/database";
import type { createDatabaseClient, NotificationService, PushSender } from "@evolyfoot/database";
import type { PublicAccount } from "./auth";

type Database = ReturnType<typeof createDatabaseClient>;

export interface NotificationSummary {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationGateway {
  list(recipientId: string): Promise<{ notifications: NotificationSummary[]; unreadCount: number; unreadMessages: number }>;
  markRead(recipientId: string, filter: { ids?: string[]; threadPlayerId?: string; kind?: "message" | "evaluation" }): Promise<void>;
  registerDevice(educatorId: string, token: unknown, platform: unknown): Promise<void>;
  unregisterDevice(educatorId: string, token: unknown): Promise<void>;
}

const expoPushUrl = "https://exp.host/--/api/v2/push/send";
const expoBatchSize = 100;

// Envoi via le service push d'Expo (pas de clé requise). Les jetons d'un téléphone désinstallé
// reviennent en « DeviceNotRegistered » et sont oubliés.
export function createExpoPushSender(fetchImpl: typeof fetch = fetch): PushSender {
  return {
    async send(messages) {
      const invalidTokens: string[] = [];
      for (let start = 0; start < messages.length; start += expoBatchSize) {
        const batch = messages.slice(start, start + expoBatchSize);
        const response = await fetchImpl(expoPushUrl, {
          method: "POST",
          headers: { accept: "application/json", "content-type": "application/json" },
          body: JSON.stringify(
            batch.map((message) => ({
              to: message.token,
              title: message.title,
              body: message.body,
              sound: "default",
              badge: message.badge,
              data: { link: message.link },
            })),
          ),
        });
        const body = (await response.json().catch(() => null)) as { data?: Array<{ status: string; details?: { error?: string } }> } | null;
        body?.data?.forEach((ticket, index) => {
          if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") invalidTokens.push(batch[index]!.token);
        });
      }
      return { invalidTokens };
    },
  };
}

// Service de notifications branché sur la base et sur le push Expo, partagé par les passerelles
// qui créent des messages ou des évaluations.
export async function notificationServiceFor(database: Database): Promise<NotificationService> {
  const { NotificationService, PrismaNotificationRepository, PrismaPushDeviceRepository } = await import("@evolyfoot/database");
  return new NotificationService(
    new PrismaNotificationRepository(database.prisma),
    new PrismaPushDeviceRepository(database.prisma),
    createExpoPushSender(),
    console.error,
  );
}

export async function createNotificationGateway(): Promise<{ gateway: NotificationGateway; disconnect: () => Promise<void> }> {
  const { createDatabaseClient } = await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const service = await notificationServiceFor(database);
  return {
    gateway: {
      async list(recipientId) {
        const result = await service.list(recipientId);
        return {
          ...result,
          notifications: result.notifications.map((notification) => ({
            id: notification.id,
            kind: notification.kind,
            title: notification.title,
            body: notification.body,
            link: notification.link,
            read: notification.readAt !== null,
            createdAt: notification.createdAt.toISOString(),
          })),
        };
      },
      markRead: (recipientId, filter) => service.markRead(recipientId, filter),
      registerDevice: (educatorId, token, platform) => service.registerDevice(educatorId, token, platform),
      unregisterDevice: (educatorId, token) => service.unregisterDevice(educatorId, token),
    },
    disconnect: database.disconnect,
  };
}

// Ouvrir un fil de messages le marque lu, sans faire échouer la lecture des messages.
export async function markNotificationsRead(recipientId: string, filter: Parameters<NotificationGateway["markRead"]>[1]): Promise<void> {
  try {
    const { gateway, disconnect } = await createNotificationGateway();
    try {
      await gateway.markRead(recipientId, filter);
    } finally {
      await disconnect();
    }
  } catch (error) {
    console.error(error);
  }
}

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

type ResolveAccount = (request: Request) => Promise<PublicAccount | null>;

export function createListNotificationsHandler(
  resolveAccount: ResolveAccount,
  notifications: Pick<NotificationGateway, "list">,
  log: (error: unknown) => void,
) {
  return async (request: Request): Promise<Response> => {
    const account = await resolveAccount(request);
    if (!account) return Response.json({ error: "Authentification requise." }, { status: 401 });
    try {
      return Response.json(await notifications.list(account.id));
    } catch (error) {
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

// `{ all: true }`, `{ ids: [...] }` ou `{ kind: "evaluation" }` (tout un type, ex. à l’ouverture de la carte du joueur).
export function createMarkNotificationsReadHandler(
  resolveAccount: ResolveAccount,
  notifications: Pick<NotificationGateway, "markRead">,
  log: (error: unknown) => void,
) {
  return async (request: Request): Promise<Response> => {
    const account = await resolveAccount(request);
    if (!account) return Response.json({ error: "Authentification requise." }, { status: 401 });
    const body = await readJsonBody(request);
    const ids = Array.isArray(body?.ids) ? body.ids : undefined;
    const kind = body?.kind === "message" || body?.kind === "evaluation" ? body.kind : undefined;
    if (body?.all !== true && !ids && !kind) return Response.json({ error: "Précise les notifications à marquer lues." }, { status: 400 });
    try {
      await notifications.markRead(account.id, ids ? { ids: ids as string[] } : kind ? { kind } : {});
      return new Response(null, { status: 204 });
    } catch (error) {
      if (error instanceof ValidationError) return Response.json({ error: error.message }, { status: 400 });
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

// Téléphone qui reçoit les push : POST `{ token, platform }` à la connexion, DELETE `{ token }` à la déconnexion.
export function createPushDeviceHandler(
  resolveAccount: ResolveAccount,
  notifications: Pick<NotificationGateway, "registerDevice" | "unregisterDevice">,
  log: (error: unknown) => void,
) {
  return async (request: Request): Promise<Response> => {
    const account = await resolveAccount(request);
    if (!account) return Response.json({ error: "Authentification requise." }, { status: 401 });
    const body = await readJsonBody(request);
    try {
      if (request.method === "DELETE") {
        await notifications.unregisterDevice(account.id, body?.token);
      } else {
        await notifications.registerDevice(account.id, body?.token, body?.platform);
      }
      return new Response(null, { status: 204 });
    } catch (error) {
      if (error instanceof ValidationError) return Response.json({ error: error.message }, { status: 400 });
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}
