import type { PrismaClient } from "./generated/prisma/client";

// Traduit les indicateurs de docs/mvp.md : l'entonnoir d'activation, l'utilisation hebdomadaire
// sur quatre semaines consécutives, la durée de saisie des comptes rendus (mesurée par l'appli
// depuis le 4 novembre 2026) et les ajustements acceptés. « Première séance planifiée en moins de
// 10 minutes » n'est pas encore instrumenté : absent plutôt qu'approximé.
export interface FunnelStep {
  label: string;
  count: number;
}

export interface WeeklyActivityPoint {
  weekStart: string;
  activeEducators: number;
}

export interface MvpMetrics {
  funnel: FunnelStep[];
  weeklyActivity: WeeklyActivityPoint[];
  retention: { retainedFourWeeks: number; activeLastFourWeeks: number };
  rosterAdoption: { educatorsWithPlayers: number; totalEducators: number };
  // Comptes rendus dont l'appli a mesuré la durée de saisie.
  reportEntry: { measured: number; underThreeMinutes: number; medianSeconds: number | null };
  // Réponses aux propositions d'ajustement sur les 4 dernières semaines (un cycle).
  adjustments: { accepted: number; declined: number; educatorsWithAccepted: number; educatorsWithObservations: number };
}

export const reportEntryTargetSeconds = 180;

// Prend `PrismaClient` directement plutôt qu'un repository comme les autres services de ce
// fichier : il n'y a ici aucune règle métier à isoler derrière une interface pour des tests unitaires
// avec un faux en mémoire (contrairement à TrainingSessionService/ObservationService, qui valident
// des données avant écriture) -- seulement de la lecture agrégée, testée contre un vrai Postgres.
export class MetricsService {
  constructor(private readonly prisma: PrismaClient) {}

  async get(): Promise<MvpMetrics> {
    const [totalEducators, educatorsWithTeam, educatorsWithDiagnostic, sessionEducators, observationEducators, playerEducators] = await Promise.all([
      // Les espaces d'équipe supplémentaires ne sont pas des comptes.
      this.prisma.educator.count({ where: { role: { not: "team" } } }),
      this.prisma.team.count({ where: { educator: { role: { not: "team" } } } }),
      this.prisma.diagnostic.count(),
      this.prisma.trainingSessionRecord.groupBy({ by: ["educatorId"] }),
      this.prisma.observationRecord.groupBy({ by: ["educatorId"] }),
      this.prisma.player.groupBy({ by: ["educatorId"] }),
    ]);

    const funnel: FunnelStep[] = [
      { label: "Comptes créés", count: totalEducators },
      { label: "Équipe configurée", count: educatorsWithTeam },
      { label: "Diagnostic réalisé", count: educatorsWithDiagnostic },
      { label: "Première séance validée", count: sessionEducators.length },
      { label: "Première observation validée", count: observationEducators.length },
    ];

    // `date_trunc`/le regroupement par semaine calendaire n'a pas d'équivalent dans le
    // constructeur de requêtes Prisma -- SQL brut nécessaire ici, seulement pour ces deux
    // requêtes de lecture agrégée. Aucune valeur interpolée : pas de risque d'injection. `::int`
    // explicite partout : Postgres retourne les agrégats en bigint, que `JSON.stringify` (donc
    // `Response.json` côté web) ne sait pas sérialiser.
    const weeklyRows = await this.prisma.$queryRaw<Array<{ week_start: Date; active_educators: number }>>`
      select date_trunc('week', created_at)::date as week_start, count(distinct educator_id)::int as active_educators
      from (
        select educator_id, created_at from training_sessions
        union all
        select educator_id, created_at from observations
      ) activity
      where created_at >= now() - interval '8 weeks'
      group by 1
      order by 1
    `;

    const retentionRows = await this.prisma.$queryRaw<Array<{ retained_four_weeks: number; active_last_four_weeks: number }>>`
      with activity as (
        select educator_id, date_trunc('week', created_at)::date as week_start
        from training_sessions
        where created_at >= now() - interval '4 weeks'
        union
        select educator_id, date_trunc('week', created_at)::date as week_start
        from observations
        where created_at >= now() - interval '4 weeks'
      ),
      weeks_per_educator as (
        select educator_id, count(distinct week_start) as weeks_active
        from activity
        group by educator_id
      )
      select
        count(*) filter (where weeks_active >= 4)::int as retained_four_weeks,
        count(*)::int as active_last_four_weeks
      from weeks_per_educator
    `;

    const retention = retentionRows[0] ?? { retained_four_weeks: 0, active_last_four_weeks: 0 };

    const entryRows = await this.prisma.$queryRaw<Array<{ measured: number; under_target: number; median_seconds: number | null }>>`
      select
        count(*)::int as measured,
        count(*) filter (where entry_seconds <= ${reportEntryTargetSeconds})::int as under_target,
        (percentile_cont(0.5) within group (order by entry_seconds))::int as median_seconds
      from observations
      where entry_seconds is not null
    `;
    const entry = entryRows[0] ?? { measured: 0, under_target: 0, median_seconds: null };

    const adjustmentRows = await this.prisma.$queryRaw<
      Array<{ accepted: number; declined: number; educators_with_accepted: number; educators_with_observations: number }>
    >`
      select
        count(*) filter (where adjustment_decision = 'accepted')::int as accepted,
        count(*) filter (where adjustment_decision = 'declined')::int as declined,
        count(distinct educator_id) filter (where adjustment_decision = 'accepted')::int as educators_with_accepted,
        count(distinct educator_id)::int as educators_with_observations
      from observations
      where created_at >= now() - interval '4 weeks'
    `;
    const adjustments = adjustmentRows[0] ?? { accepted: 0, declined: 0, educators_with_accepted: 0, educators_with_observations: 0 };

    return {
      funnel,
      weeklyActivity: weeklyRows.map((row) => ({
        weekStart: row.week_start.toISOString().slice(0, 10),
        activeEducators: row.active_educators,
      })),
      retention: {
        retainedFourWeeks: retention.retained_four_weeks,
        activeLastFourWeeks: retention.active_last_four_weeks,
      },
      rosterAdoption: {
        educatorsWithPlayers: playerEducators.length,
        totalEducators,
      },
      reportEntry: { measured: entry.measured, underThreeMinutes: entry.under_target, medianSeconds: entry.median_seconds },
      adjustments: {
        accepted: adjustments.accepted,
        declined: adjustments.declined,
        educatorsWithAccepted: adjustments.educators_with_accepted,
        educatorsWithObservations: adjustments.educators_with_observations,
      },
    };
  }
}
