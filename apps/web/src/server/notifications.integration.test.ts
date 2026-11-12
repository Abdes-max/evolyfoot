import { ValidationError } from "@evolyfoot/database";
import { describe, expect, it, vi } from "vitest";
import {
  createExpoPushSender,
  createListNotificationsHandler,
  createMarkNotificationsReadHandler,
  createNotificationPreferencesHandler,
  createPushDeviceHandler,
} from "./notifications";

const account = { id: "account-1", email: "coach@example.test", displayName: "Coach", role: "coach" as const, linkedPlayerId: null, emailVerified: true };
const authenticated = async () => account;
const anonymous = async () => null;

function post(body: unknown, method = "POST"): Request {
  return new Request("https://evolyfoot.test/api/notifications/read", { method, body: JSON.stringify(body) });
}

describe("notifications : API", () => {
  it("liste les notifications du compte connecté", async () => {
    const feed = { notifications: [], unreadCount: 2, unreadMessages: 1, pendingTutorPlayerIds: [] };
    const request = new Request("https://evolyfoot.test/api/notifications");
    expect((await createListNotificationsHandler(anonymous, { list: async () => feed }, () => undefined)(request)).status).toBe(401);
    expect(await (await createListNotificationsHandler(authenticated, { list: async () => feed }, () => undefined)(request)).json()).toEqual(feed);
  });

  it("marque tout ou une sélection comme lu", async () => {
    const calls: unknown[] = [];
    const handler = createMarkNotificationsReadHandler(authenticated, { markRead: async (id, filter) => void calls.push([id, filter]) }, () => undefined);

    expect((await handler(post({ all: true }))).status).toBe(204);
    expect((await handler(post({ ids: ["n-1"] }))).status).toBe(204);
    expect((await handler(post({}))).status).toBe(400);
    expect(calls).toEqual([
      ["account-1", {}],
      ["account-1", { ids: ["n-1"] }],
    ]);
  });

  it("lit et enregistre les réglages de notification du compte", async () => {
    const defaults = { messages: true, evaluations: true, requests: true, lockScreenContent: true, inAppBanner: true, sound: true };
    const saved: unknown[] = [];
    const gateway = {
      preferences: async () => defaults,
      savePreferences: async (_id: string, value: unknown) => {
        if (value === null) throw new ValidationError("Réglages invalides.");
        saved.push(value);
        return { ...defaults, ...(value as object) };
      },
    };
    const handler = createNotificationPreferencesHandler(authenticated, gateway, () => undefined);
    const url = "https://evolyfoot.test/api/notification-preferences";

    expect((await createNotificationPreferencesHandler(anonymous, gateway, () => undefined)(new Request(url))).status).toBe(401);
    expect(await (await handler(new Request(url))).json()).toEqual({ preferences: defaults });
    const response = await handler(new Request(url, { method: "PUT", body: JSON.stringify({ sound: false }) }));
    expect(await response.json()).toEqual({ preferences: { ...defaults, sound: false } });
    expect(saved).toEqual([{ sound: false }]);
    expect((await handler(new Request(url, { method: "PUT", body: "pas du json" }))).status).toBe(400);
  });

  it("enregistre et oublie un téléphone", async () => {
    const calls: string[] = [];
    const handler = createPushDeviceHandler(
      authenticated,
      {
        registerDevice: async (_id, token) => {
          if (token === "bad") throw new ValidationError("Téléphone invalide.");
          calls.push(`+${token}`);
        },
        unregisterDevice: async (_id, token) => void calls.push(`-${token}`),
      },
      () => undefined,
    );

    expect((await handler(post({ token: "ExponentPushToken[a]", platform: "ios" }))).status).toBe(204);
    expect((await handler(post({ token: "bad", platform: "ios" }))).status).toBe(400);
    expect((await handler(post({ token: "ExponentPushToken[a]" }, "DELETE"))).status).toBe(204);
    expect(calls).toEqual(["+ExponentPushToken[a]", "-ExponentPushToken[a]"]);
  });

  it("envoie au service push d’Expo et repère les téléphones désinstallés", async () => {
    const fetchMock = vi.fn(async () => Response.json({ data: [{ status: "ok" }, { status: "error", details: { error: "DeviceNotRegistered" } }] }));
    const sender = createExpoPushSender(fetchMock as unknown as typeof fetch);

    const result = await sender.send([
      { token: "ExponentPushToken[a]", title: "Message", body: "Salut", link: "/joueur/messages", badge: 1, sound: true },
      { token: "ExponentPushToken[b]", title: "Message", body: "Salut", link: "/joueur/messages", badge: 2, sound: false },
    ]);

    expect(result.invalidTokens).toEqual(["ExponentPushToken[b]"]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://exp.host/--/api/v2/push/send");
    expect(JSON.parse(init.body as string)[0]).toMatchObject({
      to: "ExponentPushToken[a]",
      badge: 1,
      sound: "default",
      priority: "high",
      channelId: "default",
      data: { link: "/joueur/messages" },
    });
    // Son coupé : le service Expo reçoit `sound: null`.
    expect(JSON.parse(init.body as string)[1]).toMatchObject({ sound: null });
  });
});
