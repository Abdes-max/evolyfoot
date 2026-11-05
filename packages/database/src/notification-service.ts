import { ValidationError } from "./errors";
import type {
  MessageRepository,
  NotificationInput,
  NotificationKind,
  NotificationRecord,
  NotificationRepository,
  PersistedMessage,
  PushDeviceRepository,
} from "./repositories";

// Envoi des push (service Expo côté web) : jamais bloquant, une notification reste visible dans
// l'app même si le téléphone n'a pas pu être prévenu.
export interface PushSender {
  send(messages: Array<{ token: string; title: string; body: string; link: string; badge: number }>): Promise<{ invalidTokens: string[] }>;
}

const bodyMaxLength = 140;

function excerpt(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > bodyMaxLength ? `${flat.slice(0, bodyMaxLength - 1)}…` : flat;
}

export class NotificationService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly pushDeviceRepository?: PushDeviceRepository,
    private readonly pushSender?: PushSender,
    private readonly log: (error: unknown) => void = () => undefined,
  ) {}

  // Un message dans un fil coach-joueur (messagerie ou convocation) prévient l'autre côté.
  async onMessage(message: Pick<PersistedMessage, "educatorId" | "playerId" | "authorRole" | "authorName" | "text">): Promise<void> {
    if (message.authorRole === "player") {
      const recipients = await this.notificationRepository.coachRecipients(message.educatorId);
      await this.notify(
        recipients.map((recipientId) => ({
          recipientId,
          kind: "message" as const,
          title: `Message de ${message.authorName}`,
          body: excerpt(message.text),
          // Ouvre directement le fil de ce joueur dans la messagerie du coach.
          link: `/messagerie?joueur=${message.playerId}`,
          threadPlayerId: message.playerId,
        })),
      );
      return;
    }
    const accounts = await this.notificationRepository.playerAccountIds(message.playerId);
    if (accounts.length > 0) {
      await this.notify(
        accounts.map((recipientId) => ({
          recipientId,
          kind: "message" as const,
          title: `Message de ${message.authorName}`,
          body: excerpt(message.text),
          // L’enfant concerné : un compte qui suit plusieurs enfants ouvre la bonne discussion.
          link: `/joueur/messages?enfant=${message.playerId}`,
          threadPlayerId: message.playerId,
        })),
      );
    }
  }

  async onEvaluation(playerId: string): Promise<void> {
    const accounts = await this.notificationRepository.playerAccountIds(playerId);
    if (accounts.length > 0) {
      await this.notify(
        accounts.map((recipientId) => ({
          recipientId,
          kind: "evaluation" as const,
          title: "Nouvelle évaluation",
          body: "Ton coach a ajouté une évaluation. Regarde ta progression !",
          link: "/joueur",
        })),
      );
    }
  }

  async list(recipientId: string): Promise<{ notifications: NotificationRecord[]; unreadCount: number; unreadMessages: number }> {
    const [notifications, unreadCount, unreadMessages] = await Promise.all([
      this.notificationRepository.list(recipientId, 30),
      this.notificationRepository.countUnread(recipientId),
      this.notificationRepository.countUnread(recipientId, "message"),
    ]);
    return { notifications, unreadCount, unreadMessages };
  }

  async markRead(recipientId: string, filter: { ids?: string[]; threadPlayerId?: string; kind?: NotificationKind }): Promise<void> {
    if (filter.ids && !filter.ids.every((id) => typeof id === "string")) {
      throw new ValidationError("Notifications invalides.");
    }
    return this.notificationRepository.markRead(recipientId, filter);
  }

  async registerDevice(educatorId: string, token: unknown, platform: unknown): Promise<void> {
    if (typeof token !== "string" || !/^Expo(nent)?PushToken\[.+\]$/.test(token) || (platform !== "ios" && platform !== "android")) {
      throw new ValidationError("Téléphone invalide.");
    }
    if (!this.pushDeviceRepository) throw new ValidationError("Notifications push indisponibles.");
    return this.pushDeviceRepository.register(educatorId, token, platform);
  }

  async unregisterDevice(educatorId: string, token: unknown): Promise<void> {
    if (typeof token === "string" && this.pushDeviceRepository) await this.pushDeviceRepository.unregister(educatorId, token);
  }

  private async notify(inputs: NotificationInput[]): Promise<void> {
    if (inputs.length === 0) return;
    await this.notificationRepository.createMany(inputs);
    if (!this.pushDeviceRepository || !this.pushSender) return;
    try {
      const recipients = [...new Set(inputs.map((input) => input.recipientId))];
      const [devices, badges] = await Promise.all([
        this.pushDeviceRepository.tokensFor(recipients),
        Promise.all(recipients.map(async (id) => [id, await this.notificationRepository.countUnread(id)] as const)),
      ]);
      const badgeOf = new Map(badges);
      const messages = devices.flatMap((device) =>
        inputs
          .filter((input) => input.recipientId === device.educatorId)
          .map((input) => ({ token: device.token, title: input.title, body: input.body, link: input.link, badge: badgeOf.get(device.educatorId) ?? 0 })),
      );
      if (messages.length === 0) return;
      const { invalidTokens } = await this.pushSender.send(messages);
      if (invalidTokens.length > 0) await this.pushDeviceRepository.removeTokens(invalidTokens);
    } catch (error) {
      this.log(error);
    }
  }
}

// Branche les notifications sur l'écriture des messages : messagerie et convocations passent toutes
// deux par MessageRepository.create. Une notification qui échoue n'empêche jamais le message.
export class NotifyingMessageRepository implements MessageRepository {
  constructor(
    private readonly inner: MessageRepository,
    private readonly notifications: NotificationService,
    private readonly log: (error: unknown) => void = () => undefined,
  ) {}

  listByPlayer(educatorId: string, playerId: string): Promise<PersistedMessage[]> {
    return this.inner.listByPlayer(educatorId, playerId);
  }

  async create(input: Parameters<MessageRepository["create"]>[0]): Promise<PersistedMessage> {
    const message = await this.inner.create(input);
    await this.notifications.onMessage(message).catch(this.log);
    return message;
  }
}
