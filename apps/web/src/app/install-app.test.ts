import { describe, expect, it } from "vitest";
import { installBannerSnoozeMs, installTargetForPath, isIosPhone, isSnoozed, shouldOfferInstall } from "./install-app";

const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ipad = "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const android = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const desktop = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const now = 1_800_000_000_000;
const base = { userAgent: iphone, standalone: false, pathname: "/app", dismissedAt: null, now };

describe("proposition d'installer l'app iOS", () => {
  it("ne cible que les iPhone", () => {
    expect(isIosPhone(iphone)).toBe(true);
    expect(isIosPhone(ipad)).toBe(false);
    expect(isIosPhone(android)).toBe(false);
    expect(isIosPhone(desktop)).toBe(false);
  });

  it("propose EvolyFoot Player dans l'espace joueur, Coach ailleurs", () => {
    expect(installTargetForPath("/joueur")).toBe("player");
    expect(installTargetForPath("/joueur/messages")).toBe("player");
    expect(installTargetForPath("/joueurs-vedettes")).toBe("coach");
    expect(installTargetForPath("/app")).toBe("coach");
    expect(installTargetForPath("/")).toBe("coach");
  });

  it("s'affiche sur iPhone, sauf dans une app installée, sur certaines pages ou une fois masquée", () => {
    expect(shouldOfferInstall(base)).toBe(true);
    expect(shouldOfferInstall({ ...base, userAgent: android })).toBe(false);
    expect(shouldOfferInstall({ ...base, userAgent: ipad })).toBe(false);
    expect(shouldOfferInstall({ ...base, standalone: true })).toBe(false);
    expect(shouldOfferInstall({ ...base, pathname: "/telecharger" })).toBe(false);
    expect(shouldOfferInstall({ ...base, pathname: "/admin/clubs" })).toBe(false);
    expect(shouldOfferInstall({ ...base, dismissedAt: String(now - 1000) })).toBe(false);
  });

  it("revient quand le délai est passé ou si la valeur stockée est invalide", () => {
    expect(isSnoozed(String(now - installBannerSnoozeMs - 1), now)).toBe(false);
    expect(isSnoozed(String(now - installBannerSnoozeMs + 1000), now)).toBe(true);
    expect(isSnoozed("pas un nombre", now)).toBe(false);
    expect(isSnoozed(null, now)).toBe(false);
  });
});
