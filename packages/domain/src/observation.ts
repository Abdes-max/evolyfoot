import { diagnosticCriteria, type DiagnosticCriterion } from "./diagnostic";

export type ObservationEventType = "training" | "match";
export type ObservationLevel = "reinforce" | "progress" | "achieved";
export type PlayerSignalKind = "highlight" | "support";

export interface PlayerReference {
  readonly id: string;
  readonly name: string;
}

export interface PlayerSignal {
  readonly playerId: string;
  readonly playerName: string;
  readonly kind: PlayerSignalKind;
}

export interface ObservationRating {
  readonly criterion: DiagnosticCriterion;
  readonly level: ObservationLevel;
}

export interface ObservationDraft {
  readonly id: string;
  readonly eventType: ObservationEventType;
  readonly title: string;
  readonly dateLabel: string;
  readonly players: ReadonlyArray<PlayerReference>;
  readonly ratings: ReadonlyArray<ObservationRating>;
  readonly signals: ReadonlyArray<PlayerSignal>;
  readonly note?: string;
}

export interface ObservationReportRating extends ObservationRating {
  readonly score: number;
}

export interface ObservationSummaryRating extends ObservationReportRating {
  readonly label: string;
}

export interface ObservationReportSummary {
  readonly averageScore: number;
  readonly trend: ObservationLevel;
  readonly strongest: ObservationSummaryRating;
  readonly weakest: ObservationSummaryRating;
}

export interface ObservationReport {
  readonly id: string;
  readonly eventType: ObservationEventType;
  readonly title: string;
  readonly dateLabel: string;
  readonly players: ReadonlyArray<PlayerReference>;
  readonly ratings: ReadonlyArray<ObservationReportRating>;
  readonly signals: ReadonlyArray<PlayerSignal>;
  readonly note?: string;
  readonly summary: ObservationReportSummary;
}

const levelScores: Readonly<Record<ObservationLevel, number>> = {
  reinforce: 0,
  progress: 50,
  achieved: 100,
};

function isDiagnosticCriterion(value: string): value is DiagnosticCriterion {
  return diagnosticCriteria.some((criterion) => criterion.id === value);
}

function isObservationLevel(value: string): value is ObservationLevel {
  return value === "reinforce" || value === "progress" || value === "achieved";
}

function copyDraft(draft: ObservationDraft, changes: Partial<ObservationDraft>): ObservationDraft {
  return {
    ...draft,
    ...changes,
    players: changes.players ? changes.players.map((player) => ({ ...player })) : draft.players.map((player) => ({ ...player })),
    ratings: changes.ratings ? [...changes.ratings] : [...draft.ratings],
    signals: changes.signals ? changes.signals.map((signal) => ({ ...signal })) : draft.signals.map((signal) => ({ ...signal })),
  };
}

export function createObservationDraft(
  eventType: ObservationEventType,
  title: string,
  players: ReadonlyArray<PlayerReference>,
): ObservationDraft {
  const now = new Date();
  return {
    id: `observation-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    eventType,
    title: title.trim(),
    dateLabel: new Intl.DateTimeFormat("fr-FR", { year: "numeric", month: "short", day: "numeric" }).format(now),
    players: players.map((player) => ({ ...player })),
    ratings: [],
    signals: [],
  };
}

export function rateObservation(
  draft: ObservationDraft,
  criterion: DiagnosticCriterion,
  level: ObservationLevel,
): ObservationDraft {
  if (!isDiagnosticCriterion(criterion) || !isObservationLevel(level)) return draft;
  const index = [...draft.ratings].findIndex((rating) => rating.criterion === criterion);
  const rating = { criterion, level } satisfies ObservationRating;
  const ratings = [...draft.ratings];
  if (index === -1) ratings.push(rating);
  else ratings[index] = rating;
  return copyDraft(draft, { ratings });
}

export function togglePlayerSignal(
  draft: ObservationDraft,
  player: PlayerReference | string,
  kind: PlayerSignalKind,
): ObservationDraft {
  if (kind !== "highlight" && kind !== "support") return draft;
  const playerId = typeof player === "string" ? player : player.id;
  const playerReference = [...draft.players].find((candidate) => candidate.id === playerId);
  if (!playerReference) return draft;

  const existingIndex = [...draft.signals].findIndex((signal) => signal.playerId === playerId);
  if (existingIndex >= 0 && draft.signals[existingIndex].kind === kind) {
    const signals = [...draft.signals];
    signals.splice(existingIndex, 1);
    return copyDraft(draft, { signals });
  }

  const signal: PlayerSignal = { playerId, playerName: playerReference.name, kind };
  const signals = [...draft.signals];
  if (existingIndex >= 0) signals[existingIndex] = signal;
  else signals.push(signal);
  return copyDraft(draft, { signals });
}

export function setObservationNote(draft: ObservationDraft, note: string): ObservationDraft {
  return copyDraft(draft, { note });
}

export function canCompleteObservation(draft: ObservationDraft): boolean {
  return diagnosticCriteria.every((criterion) =>
    [...draft.ratings].some((rating) => rating.criterion === criterion.id && isObservationLevel(rating.level)),
  );
}

function summaryTrend(averageScore: number): ObservationLevel {
  if (averageScore <= 25) return "reinforce";
  if (averageScore >= 75) return "achieved";
  return "progress";
}

export function completeObservation(draft: ObservationDraft): ObservationReport {
  if (!canCompleteObservation(draft)) throw new Error("Les quatre comportements doivent être renseignés.");

  const ratings = diagnosticCriteria.map((criterion) => {
    const rating = [...draft.ratings].find((candidate) => candidate.criterion === criterion.id);
    const level = rating?.level as ObservationLevel;
    return { criterion: criterion.id, level, score: levelScores[level] };
  });
  const strongest = ratings.reduce((best, rating) => (rating.score > best.score ? rating : best), ratings[0]);
  const weakest = ratings.reduce((worst, rating) => (rating.score < worst.score ? rating : worst), ratings[0]);
  const averageScore = ratings.reduce((sum, rating) => sum + rating.score, 0) / ratings.length;
  const withLabels = (rating: ObservationReportRating): ObservationSummaryRating => ({
    ...rating,
    label: [...diagnosticCriteria].find((criterion) => criterion.id === rating.criterion)?.label ?? rating.criterion,
  });
  const summary: ObservationReportSummary = Object.freeze({
    averageScore,
    trend: summaryTrend(averageScore),
    strongest: Object.freeze(withLabels(strongest)),
    weakest: Object.freeze(withLabels(weakest)),
  });
  const trimmedNote = draft.note?.trim();
  return Object.freeze({
    id: draft.id,
    eventType: draft.eventType,
    title: draft.title,
    dateLabel: draft.dateLabel,
    players: Object.freeze(draft.players.map((player) => Object.freeze({ ...player }))),
    ratings: Object.freeze(ratings.map((rating) => Object.freeze(rating))),
    signals: Object.freeze(draft.signals.map((signal) => Object.freeze({ ...signal }))),
    ...(trimmedNote ? { note: trimmedNote } : {}),
    summary,
  });
}
