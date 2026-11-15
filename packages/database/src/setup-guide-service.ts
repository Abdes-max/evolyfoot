import type { PrismaClient } from "./generated/prisma/client";

export const setupGuideStepIds = ["players", "season", "match", "evaluation", "session", "observation", "result"] as const;
export type SetupGuideStepId = (typeof setupGuideStepIds)[number];

export interface SetupGuide {
  steps: { id: SetupGuideStepId; done: boolean }[];
  done: number;
  total: number;
  dismissed: boolean;
}

// Guide de configuration du coach : l'avancement se déduit des données réelles de l'équipe active
// (`teamId`), la fermeture du guide se mémorise sur le compte du coach (`accountId`) pour être la
// même sur le web et sur mobile.
export class SetupGuideService {
  constructor(private readonly prisma: PrismaClient) {}

  async get(accountId: string, teamId: string): Promise<SetupGuide> {
    const where = { educatorId: teamId };
    const [account, players, season, matches, evaluations, sessions, observations, played] = await Promise.all([
      this.prisma.educator.findUnique({ where: { id: accountId }, select: { setupGuideDismissedAt: true } }),
      this.prisma.player.count({ where }),
      this.prisma.seasonProgram.count({ where }),
      this.prisma.matchRecord.count({ where }),
      this.prisma.playerEvaluationRecord.count({ where: { ...where, source: "coach" } }),
      this.prisma.trainingSessionRecord.count({ where }),
      this.prisma.observationRecord.count({ where: { ...where, adjustmentDecision: "accepted" } }),
      this.prisma.matchRecord.findMany({ where: { ...where, status: "played" }, select: { playerStats: true } }),
    ]);
    const done: Record<SetupGuideStepId, boolean> = {
      players: players > 0,
      season: season > 0,
      match: matches > 0,
      evaluation: evaluations > 0,
      session: sessions > 0,
      observation: observations > 0,
      result: played.some((match) => Array.isArray(match.playerStats) && match.playerStats.length > 0),
    };
    const steps = setupGuideStepIds.map((id) => ({ id, done: done[id] }));
    return { steps, done: steps.filter((step) => step.done).length, total: steps.length, dismissed: account?.setupGuideDismissedAt != null };
  }

  async setDismissed(accountId: string, dismissed: boolean): Promise<void> {
    await this.prisma.educator.update({ where: { id: accountId }, data: { setupGuideDismissedAt: dismissed ? new Date() : null } });
  }
}
