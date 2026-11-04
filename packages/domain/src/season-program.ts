import type { DevelopmentTheme } from "./index";
import { sortTrainingDays, type TrainingDay } from "./team";
import { developmentThemes } from "./themes";
import { programSessions, type ProgramSessionDefinition } from "./program-sessions";
import { programSituations } from "./program-situations";
import type { ActivityDetails, DiagramToken, DiagramZone, TacticalDiagram, TrainingActivity, TrainingBlockKind } from "./training-session";

// Programmation de saison en sous-thèmes de jeu, inspirée de la programmation CFI U10-U11 (FFF) :
// deux phases (avec et sans ballon), neuf sous-thèmes rangés sous les cinq thèmes de l'app, des
// séances de 75 minutes en six situations. Les textes et schémas sont propres à EvolyFoot.
export type GamePhase = "withBall" | "withoutBall";

export type ProgramSubTheme =
  "createSpaces" | "playBetweenLines" | "switchPlay" | "combinePlay" | "getFree" | "slowProgression" | "unbalancedShape" | "densifyAxis" | "defendGoal";

export interface ProgramSubThemeInfo {
  readonly label: string;
  readonly phase: GamePhase;
  readonly theme: DevelopmentTheme;
}

export const programSubThemes: Readonly<Record<ProgramSubTheme, ProgramSubThemeInfo>> = {
  createSpaces: { label: "Créer et utiliser les espaces", phase: "withBall", theme: "Conserver le ballon" },
  playBetweenLines: { label: "Jouer dans les intervalles et entre les lignes", phase: "withBall", theme: "Conserver le ballon" },
  switchPlay: { label: "Fixer d’un côté pour jouer à l’opposé", phase: "withBall", theme: "Progresser ensemble" },
  combinePlay: { label: "Combiner pour créer le surnombre", phase: "withBall", theme: "Progresser ensemble" },
  getFree: { label: "Se démarquer pour éliminer, passer ou finir", phase: "withBall", theme: "Finir les actions" },
  slowProgression: { label: "Freiner la progression adverse et se réaligner", phase: "withoutBall", theme: "Récupérer rapidement" },
  unbalancedShape: { label: "Se réorganiser quand l’équipe est déséquilibrée", phase: "withoutBall", theme: "Récupérer rapidement" },
  densifyAxis: { label: "Fermer l’axe ballon-but et récupérer en bloc", phase: "withoutBall", theme: "Protéger son but" },
  defendGoal: { label: "Défendre son but, récupérer ou dégager", phase: "withoutBall", theme: "Protéger son but" },
};

export const programSubThemeIds = Object.keys(programSubThemes) as ProgramSubTheme[];

export function subThemesOf(theme: DevelopmentTheme): ProgramSubTheme[] {
  return programSubThemeIds.filter((id) => programSubThemes[id].theme === theme);
}

// Repères de la saison affichés au coach.
export const programValues: ReadonlyArray<{ readonly label: string; readonly text: string }> = [
  { label: "Plaisir", text: "Chaque joueur a son temps de jeu et chaque initiative est encouragée." },
  { label: "Respect", text: "Un climat bienveillant entre joueurs, parents, adversaires et arbitres." },
  { label: "Engagement", text: "Être là à chaque séance et à chaque match, le coach en premier." },
  { label: "Tolérance", text: "Tout le monde a sa place, et l’erreur fait partie de l’apprentissage." },
  { label: "Solidarité", text: "On s’encourage quel que soit le score, avec des rituels d’équipe." },
];

export const programPrinciples: readonly string[] = [
  "Du rythme et de l’intensité : le jeu ne s’arrête presque jamais.",
  "Des séquences courtes et chronométrées pour garder l’attention.",
  "Un défi à chaque situation : on compte les points et on bat son score.",
  "Du 1 contre 1 dans chaque séance pour oser et s’engager.",
  "Arrêter d’arrêter : on corrige pendant le jeu, on laisse jouer.",
];

export const programSource = "Inspiré de la programmation CFI U10-U11 de la FFF";

// --- Situations ---

export type SituationKind = "warmup" | "game" | "drill" | "duel" | "match";

export const situationKindLabels: Readonly<Record<SituationKind, string>> = {
  warmup: "Échauffement",
  game: "Jeu",
  drill: "Exercice",
  duel: "1 contre 1",
  match: "Match",
};

// Repère tracé sur le terrain sans délimiter d'aire de jeu : zone centrale, bandes, couloirs.
export type FieldMarks = "none" | "centerZone" | "wings" | "bands" | "thirds" | "halves" | "squares";

// Schéma d'une situation : nombre d'aires de jeu (ateliers), effectifs par aire et repères.
export interface SituationLayout {
  readonly areas: 1 | 2 | 4;
  readonly attackers: number;
  readonly defenders: number;
  readonly keepers: 0 | 1 | 2;
  readonly neutrals?: number;
  readonly marks?: FieldMarks;
}

export interface ProgramSituation extends ActivityDetails {
  readonly id: string;
  readonly kind: SituationKind;
  readonly subTheme: ProgramSubTheme | "recreational";
  readonly sequences: { readonly count: number; readonly minutes: number };
  readonly rotation: string;
  readonly variation: string;
  readonly layout: SituationLayout;
}

export function situationMinutes(situation: Pick<ProgramSituation, "sequences" | "kind">): number {
  // Séquences plus récupérations courtes entre elles, arrondi à 5 minutes près.
  const work = situation.sequences.count * situation.sequences.minutes;
  return Math.max(5, Math.round((work + situation.sequences.count - 1) / 5) * 5);
}

function blockKindOf(kind: SituationKind): TrainingBlockKind {
  if (kind === "warmup") return "activation";
  if (kind === "match") return "game";
  return "main";
}

const diagramWidth = 400;
const diagramHeight = 240;

function areaRects(areas: SituationLayout["areas"]): DiagramZone[] {
  const margin = 18;
  const gap = 10;
  const width = diagramWidth - 2 * margin;
  const height = diagramHeight - 2 * margin;
  if (areas === 1) return [{ x: margin, y: margin, width, height }];
  if (areas === 2) {
    const half = (width - gap) / 2;
    return [0, 1].map((i) => ({ x: margin + i * (half + gap), y: margin, width: half, height }));
  }
  const halfW = (width - gap) / 2;
  const halfH = (height - gap) / 2;
  return [0, 1, 2, 3].map((i) => ({ x: margin + (i % 2) * (halfW + gap), y: margin + Math.floor(i / 2) * (halfH + gap), width: halfW, height: halfH }));
}

export function fieldMarkRects(marks: FieldMarks, area: DiagramZone): DiagramZone[] {
  const { x, y, width, height } = area;
  switch (marks) {
    case "centerZone":
      return [{ x: x + width * 0.25, y: y + height * 0.2, width: width * 0.5, height: height * 0.6 }];
    case "wings":
      return [
        { x: x + width * 0.15, y, width: width * 0.7, height: height * 0.18 },
        { x: x + width * 0.15, y: y + height * 0.82, width: width * 0.7, height: height * 0.18 },
      ];
    case "bands":
      return [0, 1, 2, 3].filter((i) => i % 2 === 1).map((i) => ({ x: x + (width / 4) * i, y, width: width / 4, height }));
    case "thirds":
      return [{ x: x + width / 3, y, width: width / 3, height }];
    case "halves":
      return [{ x, y, width: width / 2, height }];
    case "squares":
      return [0, 1, 2, 3].map((i) => ({
        x: x + (i % 2) * (width / 2) + 6,
        y: y + Math.floor(i / 2) * (height / 2) + 6,
        width: width / 2 - 12,
        height: height / 2 - 12,
      }));
    default:
      return [];
  }
}

// Répartit n joueurs sur des lignes parallèles au but, dans la moitié de l'aire indiquée.
function spread(count: number, area: DiagramZone, fromX: number, toX: number): Array<{ x: number; y: number }> {
  if (count <= 0) return [];
  const columns = Math.min(count, count > 4 ? 3 : 2);
  const rows = Math.ceil(count / columns);
  return Array.from({ length: count }, (_, i) => {
    const column = i % columns;
    const row = Math.floor(i / columns);
    const inRow = Math.min(columns, count - row * columns);
    return {
      x: area.x + area.width * (fromX + ((toX - fromX) * (column + 0.5)) / columns),
      y: area.y + (area.height * (row + 0.5)) / rows + (inRow < columns ? 0 : (column - (columns - 1) / 2) * 4),
    };
  });
}

export function buildSituationDiagram(layout: SituationLayout): TacticalDiagram {
  const zones = areaRects(layout.areas);
  const tokens: DiagramToken[] = [];
  zones.forEach((area, index) => {
    const prefix = layout.areas === 1 ? "" : `${index + 1}`;
    spread(layout.attackers, area, 0.15, 0.55).forEach((point, i) =>
      tokens.push({ id: `a${prefix}-${i + 1}`, ...point, role: "attacker", label: `A${i + 1}` }),
    );
    spread(layout.defenders, area, 0.5, 0.85).forEach((point, i) => tokens.push({ id: `d${prefix}-${i + 1}`, ...point, role: "defender", label: `D${i + 1}` }));
    if (layout.keepers >= 1) {
      tokens.push({ id: `g${prefix}-1`, x: area.x + area.width - 8, y: area.y + area.height / 2, role: "goalkeeper", label: "GB" });
    }
    if (layout.keepers === 2) {
      tokens.push({ id: `g${prefix}-2`, x: area.x + 8, y: area.y + area.height / 2, role: "goalkeeper", label: "GB" });
    }
    for (let i = 0; i < (layout.neutrals ?? 0); i += 1) {
      const side = i % 2 === 0 ? area.y + 6 : area.y + area.height - 6;
      tokens.push({ id: `n${prefix}-${i + 1}`, x: area.x + area.width * (0.3 + 0.4 * Math.floor(i / 2)), y: side, role: "attacker", label: "J" });
    }
  });
  const marks = zones.flatMap((area) => fieldMarkRects(layout.marks ?? "none", area));
  return { width: diagramWidth, height: diagramHeight, zones, tokens, arrows: [], ...(marks.length > 0 ? { marks } : {}) };
}

// Une situation de la programmation devient un exercice de la bibliothèque : même fiche, même
// éditeur de séance et même schéma animé que le reste du catalogue.
export function situationToActivity(situation: ProgramSituation): TrainingActivity {
  const { kind, subTheme, sequences, rotation, variation, layout, ...details } = situation;
  const theme: DevelopmentTheme = subTheme === "recreational" ? "Conserver le ballon" : programSubThemes[subTheme].theme;
  return {
    ...details,
    kind: blockKindOf(kind),
    compatibleThemes: [theme],
    rules: [...details.rules, ...(variation ? [`Variante : ${variation}`] : [])],
    coachingPoints: [...details.coachingPoints, ...(rotation ? [`Rotations : ${rotation}`] : [])],
    diagram: buildSituationDiagram(layout),
  };
}

// --- Saison priorisée ---

export interface SeasonSlot {
  readonly week: number;
  readonly sessionNumber: number;
  readonly type: ProgramSessionDefinition["type"];
  readonly subTheme: ProgramSubTheme | null;
  // Séance d'un thème prioritaire choisi par le coach.
  readonly major: boolean;
}

export interface SeasonWeek {
  readonly week: number;
  readonly slots: readonly SeasonSlot[];
}

export interface SeasonOptions {
  // Un ou deux thèmes prioritaires ; aucun = saison équilibrée.
  readonly priorities: readonly DevelopmentTheme[];
  readonly sessionsPerWeek: number;
  readonly weeks?: number;
}

export const seasonWeekCount = 36;
export const maxSeasonPriorities = 2;
// Part des séances à thème réservée aux priorités.
export const majorShare = 0.6;
const minorMinimum = 2;
const blockSize = 3;

export function findProgramSession(number: number): ProgramSessionDefinition | undefined {
  return programSessions.find((session) => session.number === number);
}

function sessionsOf(subTheme: ProgramSubTheme): number[] {
  return programSessions.filter((session) => session.type === "theme" && session.subTheme === subTheme).map((session) => session.number);
}

// Semaine et ordre des séances fixes : évaluations en début, milieu et fin, récréatives régulières.
function fixedSlots(weeks: number, perWeek: number): Map<number, number[]> {
  const fixed = new Map<number, number[]>();
  const add = (week: number, number: number) => fixed.set(week, [...(fixed.get(week) ?? []), number]);
  const middle = Math.ceil(weeks / 2) + 1;
  const evaluationWeeks = perWeek >= 2 ? [1, 1, middle, middle, weeks, weeks] : [1, 2, middle, middle + 1, weeks - 1, weeks];
  [1, 2, 37, 38, 70, 71].forEach((number, index) => add(evaluationWeeks[index]!, number));
  const recreational = programSessions.filter((session) => session.type === "recreational").map((session) => session.number);
  const recreationalWeeks = perWeek >= 2 ? [9, 15, 21, 27, 32, weeks - 1] : [12, 24, 30];
  recreationalWeeks.forEach((week, index) => {
    if (week <= weeks && recreational[index] !== undefined && (fixed.get(week)?.length ?? 0) < perWeek) add(week, recreational[index]!);
  });
  return fixed;
}

function quotas(themedSlots: number, priorities: readonly DevelopmentTheme[]): Map<ProgramSubTheme, number> {
  const majors = programSubThemeIds.filter((id) => priorities.includes(programSubThemes[id].theme));
  const minors = programSubThemeIds.filter((id) => !majors.includes(id));
  const result = new Map<ProgramSubTheme, number>();
  if (majors.length === 0) {
    programSubThemeIds.forEach((id, index) => result.set(id, Math.floor(themedSlots / 9) + (index < themedSlots % 9 ? 1 : 0)));
    return result;
  }
  const minorTotal = Math.max(minors.length * minorMinimum, Math.round(themedSlots * (1 - majorShare)));
  const majorTotal = themedSlots - minorTotal;
  // Chaque thème prioritaire reçoit la même part, partagée entre ses sous-thèmes.
  const perTheme = majorTotal / priorities.length;
  let given = 0;
  majors.forEach((id) => {
    const count = Math.floor(perTheme / subThemesOf(programSubThemes[id].theme).length);
    result.set(id, count);
    given += count;
  });
  for (let i = 0; given < majorTotal; i += 1, given += 1) result.set(majors[i % majors.length]!, result.get(majors[i % majors.length]!)! + 1);
  minors.forEach((id, index) => result.set(id, Math.floor(minorTotal / minors.length) + (index < minorTotal % minors.length ? 1 : 0)));
  return result;
}

// Ordre des blocs de séances : répartition régulière (tourniquet pondéré) en alternant, quand
// c'est possible, une phase avec ballon et une phase sans ballon.
function orderBlocks(quota: Map<ProgramSubTheme, number>): ProgramSubTheme[] {
  const remaining = new Map(quota);
  const total = [...quota.values()].reduce((sum, count) => sum + count, 0);
  const credit = new Map<ProgramSubTheme, number>(programSubThemeIds.map((id) => [id, 0]));
  const order: ProgramSubTheme[] = [];
  let lastPhase: GamePhase | null = null;
  while (order.length < total) {
    const open = programSubThemeIds.filter((id) => (remaining.get(id) ?? 0) > 0);
    open.forEach((id) => credit.set(id, credit.get(id)! + quota.get(id)!));
    const otherPhase = open.filter((id) => programSubThemes[id].phase !== lastPhase);
    const pool = otherPhase.length > 0 ? otherPhase : open;
    const pick = pool.reduce((best, id) => (credit.get(id)! > credit.get(best)! ? id : best));
    const size = Math.min(blockSize, remaining.get(pick)!);
    for (let i = 0; i < size; i += 1) order.push(pick);
    remaining.set(pick, remaining.get(pick)! - size);
    credit.set(pick, credit.get(pick)! - total);
    lastPhase = programSubThemes[pick].phase;
  }
  return order;
}

export function buildPrioritizedSeason(options: SeasonOptions): SeasonWeek[] {
  const weeks = options.weeks ?? seasonWeekCount;
  const perWeek = Math.min(4, Math.max(1, Math.round(options.sessionsPerWeek)));
  const priorities = [...new Set(options.priorities)].slice(0, maxSeasonPriorities);
  const fixed = fixedSlots(weeks, perWeek);
  const fixedCount = [...fixed.values()].reduce((sum, list) => sum + list.length, 0);
  const order = orderBlocks(quotas(weeks * perWeek - fixedCount, priorities));
  const cursor = new Map<ProgramSubTheme, number>();
  let next = 0;

  return Array.from({ length: weeks }, (_, index) => {
    const week = index + 1;
    const numbers = [...(fixed.get(week) ?? [])];
    while (numbers.length < perWeek && next < order.length) {
      const subTheme = order[next]!;
      next += 1;
      const catalogue = sessionsOf(subTheme);
      const position = cursor.get(subTheme) ?? 0;
      cursor.set(subTheme, position + 1);
      numbers.push(catalogue[position % catalogue.length]!);
    }
    const slots = numbers.map((sessionNumber) => {
      const session = findProgramSession(sessionNumber)!;
      const subTheme = session.type === "theme" ? session.subTheme : null;
      return {
        week,
        sessionNumber,
        type: session.type,
        subTheme,
        major: subTheme !== null && priorities.includes(programSubThemes[subTheme].theme),
      };
    });
    return { week, slots };
  });
}

// Priorités proposées à partir du diagnostic : les deux thèmes les plus faibles.
export function suggestSeasonPriorities(summary: { priorities: readonly { theme: DevelopmentTheme }[] }): DevelopmentTheme[] {
  return [...new Set(summary.priorities.map((priority) => priority.theme))].slice(0, maxSeasonPriorities);
}

// Priorités envoyées par le coach : un ou deux thèmes connus, sans doublon.
export function validateSeasonPriorities(value: unknown): DevelopmentTheme[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > maxSeasonPriorities) {
    throw new Error("Choisis un ou deux thèmes prioritaires.");
  }
  const themes = [...new Set(value)];
  if (themes.length !== value.length || !themes.every((theme) => developmentThemes.includes(theme as DevelopmentTheme))) {
    throw new Error("Thème prioritaire inconnu.");
  }
  return themes as DevelopmentTheme[];
}

// Lundi de la semaine d'une date, à minuit (heure locale).
export function mondayOf(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

// Semaine de saison (1 à 36) d'une date, la saison commençant la semaine de `start`.
export function seasonWeekAt(start: Date, now: Date, weeks = seasonWeekCount): number {
  const days = Math.round((mondayOf(now).getTime() - mondayOf(start).getTime()) / 86_400_000);
  return Math.min(weeks, Math.max(1, Math.floor(days / 7) + 1));
}

// Les séances préparées depuis la saison guidée sont rangées hors des cycles de 4 semaines : cycle
// réservé 0, semaine = semaine de saison (1 à 36), créneau = rang de la séance dans la semaine.
export const guidedSeasonCycle = 0;

export interface ProgramSessionPlan {
  readonly title: string;
  readonly theme: DevelopmentTheme;
  readonly intention: string;
  readonly blocks: ReadonlyArray<{ readonly activityId: string; readonly durationMinutes: number }>;
}

// Une évaluation se joue en matchs à 8 contre 8 après un échauffement préventif.
const evaluationBlocks = [
  { activityId: "cfi-freiner-gammes", durationMinutes: 15 },
  { activityId: "cfi-recre-futsal", durationMinutes: 20 },
  { activityId: "cfi-recre-futsal", durationMinutes: 20 },
  { activityId: "cfi-recre-futsal", durationMinutes: 20 },
];

export function programSessionPlan(number: number): ProgramSessionPlan | null {
  const session = findProgramSession(number);
  if (!session) return null;
  if (session.type === "evaluation") {
    const attack = session.focus === "attack";
    return {
      title: `Séance ${number} · Évaluation collective (${attack ? "attaque" : "défense"})`,
      theme: attack ? "Finir les actions" : "Protéger son but",
      intention: "Trois matchs dans les mêmes conditions pour mesurer la progression de l’équipe.",
      blocks: evaluationBlocks,
    };
  }
  const blocks = session.situations.map((id) => {
    const situation = programSituations.find((candidate) => candidate.id === id)!;
    return { activityId: id, durationMinutes: situationMinutes(situation) };
  });
  const missing = 75 - blocks.reduce((sum, block) => sum + block.durationMinutes, 0);
  if (missing > 0) blocks[blocks.length - 1] = { ...blocks[blocks.length - 1]!, durationMinutes: blocks[blocks.length - 1]!.durationMinutes + missing };
  if (session.type === "recreational") {
    return {
      title: `Séance ${number} · Séance récréative`,
      theme: "Conserver le ballon",
      intention: "Jouer, s’amuser et attaquer-défendre en continu.",
      blocks,
    };
  }
  const info = programSubThemes[session.subTheme];
  return { title: `Séance ${number} · ${info.label}`, theme: info.theme, intention: info.label, blocks };
}

const weekdayOffsets: Readonly<Record<TrainingDay, number>> = { Lundi: 0, Mardi: 1, Mercredi: 2, Jeudi: 3, Vendredi: 4 };

// Rendez-vous proposé pour un créneau de la saison : le jour d'entraînement correspondant au rang
// de la séance dans la semaine (mercredi par défaut), à 18 h.
export function seasonSlotDate(startDate: Date, week: number, slot: number, trainingDays: readonly TrainingDay[]): Date {
  const days = sortTrainingDays(trainingDays);
  const day = days[slot] ?? days[days.length - 1] ?? "Mercredi";
  const date = mondayOf(startDate);
  date.setDate(date.getDate() + (week - 1) * 7 + weekdayOffsets[day]);
  date.setHours(18, 0, 0, 0);
  return date;
}
