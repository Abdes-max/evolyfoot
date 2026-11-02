import { describe, expect, it } from "vitest";
import { buildTeamStatsReport, type TeamStats } from "./team-stats-report";

const empty = { present: 0, absent: 0, total: 0, rate: 0 };
const base: TeamStats = {
  trainingCount: 1,
  matchCount: 2,
  matchesPlayed: 1,
  matchesScheduled: 1,
  tournamentCount: 0,
  plateauCount: 0,
  trainingAttendance: empty,
  matchAttendance: empty,
};

describe("buildTeamStatsReport", () => {
  it("accorde les pluriels et signale l'absence de présences", () => {
    expect(buildTeamStatsReport(base)).toEqual([
      "Depuis le début de la saison : 1 séance et 2 matchs (1 joué, 1 à venir).",
      "Aucune présence n’a encore été relevée à l’entraînement (elle se saisit à la préparation d’une séance).",
    ]);
  });

  it("ajoute compétitions et présences quand il y en a", () => {
    const report = buildTeamStatsReport({
      ...base,
      tournamentCount: 1,
      plateauCount: 2,
      trainingAttendance: { present: 8, absent: 2, total: 10, rate: 80 },
      matchAttendance: { present: 9, absent: 1, total: 10, rate: 90 },
    });

    expect(report).toContain("1 tournoi et 2 plateaux.");
    expect(report).toContain("Présence moyenne à l’entraînement : 80% (8 présences sur 10 relevées).");
    expect(report).toContain("Présence moyenne en match : 90%.");
  });
});
