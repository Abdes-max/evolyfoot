import { describe, expect, it } from "vitest";
import { NotificationService, NotifyingMessageRepository, type PushSender } from "./notification-service";
import type {
  MessageRepository,
  NotificationInput,
  NotificationKind,
  NotificationPreferenceRepository,
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
  async pendingFollowRequestPlayerIds() {
    return [];
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

class InMemoryPreferences implements NotificationPreferenceRepository {
  readonly stored = new Map<string, unknown>();
  async get(educatorId: string) {
    return this.stored.get(educatorId) ?? null;
  }
  async getMany(educatorIds: string[]) {
    return new Map(educatorIds.map((id) => [id, this.stored.get(id) ?? null]));
  }
  async save(educatorId: string, preferences: unknown) {
    this.stored.set(educatorId, preferences);
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
      ["coach-1", "Message de Lina", "/messagerie?joueur=player-1"],
      ["assistant-1", "Message de Lina", "/messagerie?joueur=player-1"],
    ]);
    expect(sent).toEqual([
      [{ token: "ExponentPushToken[coach]", title: "Message de Lina", body: message.text, link: "/messagerie?joueur=player-1", badge: 1, sound: true }],
    ]);
  });

  it("prévient le compte du joueur d’un message du coach et d’une évaluation, et oublie un téléphone désinstallé", async () => {
    const notifications = new InMemoryNotifications({}, { "player-1": "account-1" });
    const devices = new InMemoryDevices();
    const service = new NotificationService(notifications, devices, { send: async () => ({ invalidTokens: ["ExponentPushToken[old]"] }) });

    await service.onMessage({ ...message, authorRole: "coach", authorName: "Coach Sam" });
    await service.onEvaluation("player-1");
    await service.onEvaluation("sans-compte");

    expect(notifications.records.map((record) => [record.recipientId, record.kind, record.link])).toEqual([
      ["account-1", "message", "/joueur/messages?enfant=player-1"],
      ["account-1", "evaluation", "/joueur"],
    ]);
    expect(devices.devices.map((device) => device.token)).toEqual(["ExponentPushToken[coach]"]);
  });

  describe("réglages de notification", () => {
    function setup() {
      const notifications = new InMemoryNotifications({ "team-1": ["coach-1"] }, { "player-1": "account-1" });
      const preferences = new InMemoryPreferences();
      const sent: Parameters<PushSender["send"]>[0][] = [];
      const service = new NotificationService(
        notifications,
        new InMemoryDevices(),
        {
          send: async (messages) => {
            sent.push(messages);
            return { invalidTokens: [] };
          },
        },
        () => undefined,
        preferences,
      );
      return { notifications, preferences, sent, service };
    }

    it("une catégorie désactivée coupe le push mais garde la notification dans la liste", async () => {
      const { notifications, sent, service } = setup();
      await service.savePreferences("coach-1", { messages: false });

      await service.onMessage({ ...message, authorRole: "player" });

      expect(notifications.records).toHaveLength(1);
      expect(sent).toEqual([]);
    });

    it("masque le texte sur l'écran verrouillé et coupe le son si demandé", async () => {
      const { sent, service } = setup();
      await service.savePreferences("coach-1", { lockScreenContent: false, sound: false });

      await service.onMessage({ ...message, authorRole: "player" });

      expect(sent[0]?.[0]).toMatchObject({ title: "EvolyFoot", body: "Nouvelle notification", sound: false, link: "/messagerie?joueur=player-1" });
    });

    it("sans réglage enregistré, tout est activé", async () => {
      const { sent, service } = setup();
      expect(await service.preferences("coach-1")).toMatchObject({ messages: true, lockScreenContent: true, sound: true });

      await service.onMessage({ ...message, authorRole: "player" });

      expect(sent[0]?.[0]).toMatchObject({ title: "Message de Lina", sound: true });
    });

    it("enregistre des réglages complets et refuse un corps invalide", async () => {
      const { preferences, service } = setup();
      const saved = await service.savePreferences("coach-1", { evaluations: false, sound: "non" });
      expect(saved).toMatchObject({ evaluations: false, sound: true, messages: true });
      expect(preferences.stored.get("coach-1")).toEqual(saved);
      await expect(service.savePreferences("coach-1", null)).rejects.toThrow("Réglages invalides.");
      await expect(service.savePreferences("coach-1", [])).rejects.toThrow("Réglages invalides.");
    });
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
