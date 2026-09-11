import { describe, expect, it } from "vitest";
import { matchKickoffTime, matchMeetingTime } from "./match-time";

describe("matchKickoffTime", () => {
  it("formate l'heure du coup d'envoi dans le fuseau du club (Europe/Paris), pas celui du serveur", () => {
    // 14:30 UTC = 16:30 à Paris en septembre (heure d'été, UTC+2) -- vérifie que la conversion a
    // bien lieu plutôt que de se contenter du fuseau système d'exécution des tests.
    expect(matchKickoffTime(new Date("2026-09-19T14:30:00.000Z"))).toBe("16:30");
  });

  it("retourne null sans vraie date", () => {
    expect(matchKickoffTime(null)).toBeNull();
  });
});

describe("matchMeetingTime", () => {
  it("calcule le rendez-vous à X minutes avant le coup d'envoi, dans le fuseau du club", () => {
    expect(matchMeetingTime(new Date("2026-09-19T14:30:00.000Z"), 30, null)).toBe("16:00");
  });

  it("retombe sur le texte libre sans offset renseigné", () => {
    expect(matchMeetingTime(new Date("2026-09-19T14:30:00.000Z"), null, "13:45")).toBe("13:45");
  });

  it("retombe sur le texte libre sans vraie date", () => {
    expect(matchMeetingTime(null, 30, "13:45")).toBe("13:45");
  });

  it("retourne null sans date ni texte libre", () => {
    expect(matchMeetingTime(null, null, null)).toBeNull();
  });
});
