import { describe, expect, it } from "vitest";
import {
  billingAccess,
  billingItemOfLookupKey,
  billingReminderDue,
  billingLines,
  billingPriceLookupKey,
  billingTotal,
  parseBillingCycle,
  trialEndOf,
} from "./billing";

describe("abonnement", () => {
  it("facture la base seule pour 1 coach et 1 équipe", () => {
    const lines = billingLines("monthly", 0, 0);
    expect(lines).toEqual([{ item: "base", quantity: 1, unitPrice: 7.9 }]);
    expect(billingTotal(lines)).toBe(7.9);
  });

  it("ajoute les équipes et coachs en plus, au tarif réduit", () => {
    const lines = billingLines("season", 2, 1);
    expect(lines.map((line) => [line.item, line.quantity])).toEqual([
      ["base", 1],
      ["team", 2],
      ["coach", 1],
    ]);
    expect(billingTotal(lines)).toBe(59 + 2 * 29 + 24);
    expect(billingTotal(billingLines("monthly", 1, 2))).toBe(17.6);
  });

  it("retrouve l'article et le rythme depuis la clé du prix", () => {
    expect(billingItemOfLookupKey(billingPriceLookupKey("team", "season"))).toEqual({ item: "team", cycle: "season" });
    expect(billingItemOfLookupKey("autre")).toBeNull();
    expect(parseBillingCycle("season")).toBe("season");
    expect(parseBillingCycle("annual")).toBeNull();
  });

  it("donne 14 jours d'essai après l'inscription, sauf date déjà fixée", () => {
    const createdAt = new Date("2026-11-01T10:00:00Z");
    expect(trialEndOf(createdAt, null).toISOString()).toBe("2026-11-15T10:00:00.000Z");
    const fixed = new Date("2026-12-01T00:00:00Z");
    expect(trialEndOf(createdAt, fixed)).toBe(fixed);
  });

  it("calcule l'accès : abonné, en essai ou essai terminé", () => {
    const createdAt = new Date("2026-11-01T10:00:00Z");
    expect(billingAccess({ createdAt, trialEndsAt: null, subscriptionStatus: "active", now: new Date("2027-01-01") })).toEqual({
      state: "subscribed",
      status: "active",
    });
    expect(billingAccess({ createdAt, trialEndsAt: null, subscriptionStatus: null, now: new Date("2026-11-10T10:00:00Z") })).toMatchObject({
      state: "trial",
      daysLeft: 5,
    });
    expect(billingAccess({ createdAt, trialEndsAt: null, subscriptionStatus: "canceled", now: new Date("2026-11-20") }).state).toBe("expired");
    expect(billingAccess({ createdAt, trialEndsAt: null, subscriptionStatus: "past_due", now: new Date("2027-01-01") }).state).toBe("subscribed");
  });

  it("rappelle la fin d'essai, l'essai terminé et les suppléments à mettre à jour, une seule fois chacun", () => {
    const now = new Date("2026-11-20T10:00:00Z");
    const base = { everSubscribed: false, extraTeams: 0, extraCoaches: 0, billedExtraTeams: null, billedExtraCoaches: null, lastReminder: null, now };
    const trial = (daysLeft: number) => ({ state: "trial" as const, trialEndsAt: now, daysLeft });
    expect(billingReminderDue({ ...base, access: trial(5) })).toBeNull();
    expect(billingReminderDue({ ...base, access: trial(3) })).toEqual({ kind: "trial-ending", key: "trial-ending" });
    expect(billingReminderDue({ ...base, access: trial(2), lastReminder: "trial-ending" })).toBeNull();

    const expired = (daysAgo: number) => ({ state: "expired" as const, trialEndsAt: new Date(now.getTime() - daysAgo * 24 * 3600 * 1000) });
    expect(billingReminderDue({ ...base, access: expired(1), lastReminder: "trial-ending" })?.kind).toBe("trial-ended");
    expect(billingReminderDue({ ...base, access: expired(30) })).toBeNull();
    expect(billingReminderDue({ ...base, access: expired(1), everSubscribed: true })).toBeNull();

    const subscribed = { ...base, access: { state: "subscribed" as const, status: "active" }, billedExtraTeams: 1, billedExtraCoaches: 0 };
    expect(billingReminderDue({ ...subscribed, extraTeams: 1 })).toBeNull();
    expect(billingReminderDue({ ...subscribed, extraTeams: 2, extraCoaches: 1 })).toEqual({ kind: "extras", key: "extras:2:1" });
    expect(billingReminderDue({ ...subscribed, extraTeams: 2, extraCoaches: 1, lastReminder: "extras:2:1" })).toBeNull();
  });
});
