import { describe, expect, it } from "vitest";
import { NotificationService, NotifyingMessageRepository, type PushSender } from "./notification-service";
import type {
  MessageRepository,
  NotificationInput,
  NotificationKind,
  NotificationRecord,
  NotificationRepository,
  PersistedMessage,
  PushDeviceRepository,
} from "./repositories";

class InMemoryNotifications implements NotificationRepository {
  readonly records: NotificationRecord[] = [];
  constructor(
    private readonly coaches: Record<string, string[]>,
    private readonly accounts: Record<string, string>,
  ) {}
  async coachRecipients(educatorId: string) {
    return this.coaches[educatorId] ?? [];
  }
  async playerAccountIds(playerId: string) {
    return this.accounts[playerId] ? [this.accounts[playerId]!] : [];
  }
  async createMany(inputs: NotificationInput[]) {
    for (const input of inputs) {
      this.records.push({ ...input, threadPlayerId: input.threadPlayerId ?? null, id: `n-${this.records.length + 1}`, readAt: null, createdAt: new Date() });
    }
  }
  async list(recipientId: string) {
    return this.records.filter((record) => record.recipientId === recipientId);
  }
  async countUnread(recipientId: string, kind?: NotificationKind) {
    return this.records.filter((record) => record.recipientId === recipientId && !record.readAt && (!kind || record.kind === kind)).length;
  }
  async markRead(recipientId: string, filter: { ids?: string[]; threadPlayerId?: string; kind?: NotificationKind }) {
    for (const record of this.records) {
      if (record.recipientId !== recipientId) continue;
      if (filter.ids && !filter.ids.includes(record.id)) continue;
      if (filter.threadPlayerId && record.threadPlayerId !== filter.threadPlayerId) continue;
      if (filter.kind && record.kind !== filter.kind) continue;
      record.readAt = new Date();
    }
  }
}

class InMemoryDevices implements PushDeviceRepository {
  devices = [
    { educatorId: "coach-1", token: "ExponentPushToken[coach]" },
    { educatorId: "account-1", token: "ExponentPushToken[old]" },
  ];
  async register(educatorId: string, token: string) {
    this.devices.push({ educatorId, token });
  }
  async unregister(educatorId: string, token: string) {
    this.devices = this.devices.filter((device) => !(device.educatorId === educatorId && device.token === token));
  }
  async tokensFor(ids: string[]) {
    return this.devices.filter((device) => ids.includes(device.educatorId));
  }
  async removeTokens(tokens: string[]) {
    this.devices = this.devices.filter((device) => !tokens.includes(device.token));
  }
}

const message = { educatorId: "team-1", playerId: "player-1", authorName: "Lina", text: "Bonjour coach, je serai en retard." };

describe("NotificationService", () => {
  it("prévient le coach et ses adjoints d’un message du joueur, avec un push et la pastille", async () => {
    const notifications = new InMemoryNotifications({ "team-1": ["coach-1", "assistant-1"] }, {});
    const sent: Parameters<PushSender["send"]>[0][] = [];
    const service = new NotificationService(notifications, new InMemoryDevices(), {
      send: async (messages) => {
        sent.push(messages);
        return { invalidTokens: [] };
      },
    });

    await service.onMessage({ ...message, authorRole: "player" });

    expect(notifications.records.map((record) => [record.recipientId, record.title, record.link])).toEqual([
      ["coach-1", "Message de Lina", "/equipe/player-1"],
      ["assistant-1", "Message de Lina", "/equipe/player-1"],
    ]);
    expect(sent).toEqual([[{ token: "ExponentPushToken[coach]", title: "Message de Lina", body: message.text, link: "/equipe/player-1", badge: 1 }]]);
  });

  it("prévient le compte du joueur d’un message du coach et d’une évaluation, et oublie un téléphone désinstallé", async () => {
    const notifications = new InMemoryNotifications({}, { "player-1": "account-1" });
    const devices = new InMemoryDevices();
    const service = new NotificationService(notifications, devices, { send: async () => ({ invalidTokens: ["ExponentPushToken[old]"] }) });

    await service.onMessage({ ...message, authorRole: "coach", authorName: "Coach Sam" });
    await service.onEvaluation("player-1");
    await service.onEvaluation("sans-compte");

    expect(notifications.records.map((record) => [record.recipientId, record.kind, record.link])).toEqual([
      ["account-1", "message", "/joueur/messages"],
      ["account-1", "evaluation", "/joueur"],
    ]);
    expect(devices.devices.map((device) => device.token)).toEqual(["ExponentPushToken[coach]"]);
  });

  it("compte les non lus et marque un fil lu", async () => {
    const notifications = new InMemoryNotifications({}, { "player-1": "account-1" });
    const service = new NotificationService(notifications);
    await service.onMessage({ ...message, authorRole: "coach" });
    await service.onEvaluation("player-1");

    expect(await service.list("account-1")).toMatchObject({ unreadCount: 2, unreadMessages: 1 });
    await service.markRead("account-1", { threadPlayerId: "player-1" });
    expect(await service.list("account-1")).toMatchObject({ unreadCount: 1, unreadMessages: 0 });
  });

  it("n’accepte qu’un jeton push Expo", async () => {
    const devices = new InMemoryDevices();
    const service = new NotificationService(new InMemoryNotifications({}, {}), devices);
    await expect(service.registerDevice("coach-1", "pas-un-jeton", "ios")).rejects.toThrow("Téléphone invalide.");
    await expect(service.registerDevice("coach-1", "ExponentPushToken[x]", "web")).rejects.toThrow("Téléphone invalide.");
    await service.registerDevice("coach-1", "ExponentPushToken[x]", "android");
    expect(devices.devices.at(-1)).toEqual({ educatorId: "coach-1", token: "ExponentPushToken[x]" });
  });

  it("n’empêche jamais l’envoi d’un message si la notification échoue", async () => {
    const inner: MessageRepository = {
      listByPlayer: async () => [],
      create: async (input) => ({ ...input, id: "m-1", createdAt: new Date() }) as PersistedMessage,
    };
    const failing = new NotificationService({
      coachRecipients: async () => {
        throw new Error("base indisponible");
      },
    } as unknown as NotificationRepository);
    const errors: unknown[] = [];
    const repository = new NotifyingMessageRepository(inner, failing, (error) => errors.push(error));

    const created = await repository.create({ ...message, authorRole: "player" });

    expect(created.id).toBe("m-1");
    expect(errors).toHaveLength(1);
  });
});
