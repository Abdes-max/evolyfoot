import type { DiagramToken, DiagramZone, TrainingActivity } from "./training-session";

// Animation d'un exercice, calculée à partir de son schéma et de sa fiche : un même exercice rejoue
// toujours la même séquence, sans rien à stocker. Le scénario (conduite, passe et suit, progression,
// finition, pressing, conservation) se déduit de la consigne et des règles, et chaque étape affiche
// un texte de la fiche plutôt qu'une légende générique.
export interface AnimationPoint {
  readonly x: number;
  readonly y: number;
}

export type AnimationBallKind = "pass" | "dribble" | "shot" | "steal";

export interface AnimationBall {
  readonly kind: AnimationBallKind;
  readonly fromId: string;
  // Receveur d'une passe ou d'une récupération, le porteur lui-même pour une conduite, `null` pour un tir.
  readonly toId: string | null;
  // Point visé par un tir.
  readonly target: AnimationPoint | null;
}

export interface AnimationStep {
  readonly caption: string;
  readonly from: Readonly<Record<string, AnimationPoint>>;
  readonly to: Readonly<Record<string, AnimationPoint>>;
  // Un ballon par zone de jeu, sauf en conduite où chaque porteur a le sien.
  readonly balls: readonly AnimationBall[];
  readonly pressers: ReadonlyArray<{ readonly id: string; readonly targetId: string }>;
  // Joueurs au cœur de l'action, les autres sont estompés.
  readonly activeIds: readonly string[];
}

export type ExerciseScenario = "possession" | "passAndMove" | "dribbling" | "progression" | "finishing" | "pressing";

export type AnimatedExercise = Pick<
  TrainingActivity,
  "kind" | "title" | "organization" | "instruction" | "observable" | "rules" | "coachingPoints" | "equipment" | "defenderCount" | "diagram"
>;

export const diagramAnimationStepCount = 6;

const fallbackCaptions = [
  "Le ballon circule",
  "Les partenaires se rendent disponibles",
  "Passe et déplacement",
  "Nouvelle ligne de passe",
  "Passe et suit",
  "Le groupe garde son rythme",
];

const pressingWords =
  /\bpresse|pressing|récup|perte|\bperds\b|\bperd (le|ton) ballon|chasseur|\bchat\b|ferme (une|la|les)|fermer|fermé|coulisse|retarde|reconqu|intercept/;
const finishingWords = /\btir|frapp|\bfini|reprise|centre vers|et centre|\bbuts?\b|mini-but/;
const dribblingWords = /condui|balle au pied|slalom|dribbl|rapporte/;
const progressionWords = /avance|avanç|vers l’avant|devant|progress|dépasse\b|profondeur|en-but|franchi|\blignes?\b|\battaque\b|remonte|cible/;
const soloApproachWords = /condui|balle au pied|\bseul\b/;

function lower(...texts: readonly (string | undefined)[]): string {
  return texts.filter(Boolean).join(" ").toLowerCase();
}

// La zone d'en-but, la ligne de but et « finir dans une porte » ne mènent pas à un tir.
function withoutGoalLines(text: string): string {
  return text
    .replace(/en-but/g, "en-cible")
    .replace(/ligne de but/g, "ligne de fond")
    .replace(/fini[rt]? (dans une porte|en passant)/g, "atteint $1");
}

export function exerciseScenario(exercise: AnimatedExercise): ExerciseScenario {
  const rules = exercise.rules ?? [];
  const all = lower(exercise.title, exercise.organization, exercise.instruction, ...rules);
  const head = lower(exercise.organization, exercise.instruction);
  const hasOpponents = exercise.diagram.tokens.some((token) => token.role === "defender");
  // Le pressing se lit dans l'intitulé et la consigne : une règle annexe (« le défenseur qui
  // récupère… ») ne fait pas d'un exercice d'attaque un exercice de récupération.
  if (hasOpponents && pressingWords.test(lower(exercise.title, exercise.organization, exercise.instruction))) {
    return "pressing";
  }
  if (finishingWords.test(withoutGoalLines(all))) {
    return "finishing";
  }
  if (dribblingWords.test(head)) {
    return "dribbling";
  }
  if (progressionWords.test(lower(exercise.title, exercise.instruction, ...rules))) {
    return "progression";
  }
  if (exercise.kind === "game") {
    return "finishing";
  }
  return exercise.defenderCount > 0 ? "possession" : "passAndMove";
}

// Thème de chaque étape : la légende reprend le premier texte de la fiche qui en parle.
const stepTopics: Record<ExerciseScenario, readonly (RegExp | null)[]> = {
  possession: [null, /passe|touche/, /bouge|solution|disponible|angle|appui|soutien|démarqu/, /défenseur|press|récup|point/, null, null],
  passAndMove: [null, /passe|ballon|touche/, /suis|cours|déplace|place|bouge|course/, null, null, null],
  dribbling: [null, /condui|pied|ballon/, /tête|regard|accél|ligne/, null, null, null],
  progression: [
    null,
    /avant|devant|dépasse|soutien|accompagne|course/,
    /ligne|porte|en-but|franchi|point/,
    null,
    /passe|touche/,
    /ligne|porte|en-but|franchi|point/,
  ],
  finishing: [
    null,
    /passe|remise|combin|touche|condui/,
    /tir|frapp|\bbut|cadr|fini|coin/,
    null,
    /passe|touche|seconde|condui/,
    /tir|frapp|\bbut|cadr|fini|point/,
  ],
  pressing: [
    null,
    /press|ferme|coupe|proche/,
    /récup|intercept|perte|perd/,
    /seconde|replace|attaque|vite|contre|transition/,
    /\bbut|point|récup|presse/,
    null,
  ],
};

function captionsFor(exercise: AnimatedExercise, scenario: ExerciseScenario): string[] {
  const texts = [exercise.instruction, ...(exercise.rules ?? []), ...(exercise.coachingPoints ?? []), exercise.observable]
    .map((text) => text?.trim() ?? "")
    .filter((text, index, all) => text.length > 0 && all.indexOf(text) === index);
  if (texts.length === 0) {
    return fallbackCaptions.slice(0, diagramAnimationStepCount);
  }
  const used = new Set<string>([texts[0]!]);
  const captions = [texts[0]!];
  for (let index = 1; index < diagramAnimationStepCount; index += 1) {
    const topic = stepTopics[scenario][index];
    const caption =
      (topic && texts.find((text) => !used.has(text) && topic.test(text.toLowerCase()))) ??
      texts.find((text) => !used.has(text)) ??
      texts[index % texts.length]!;
    used.add(caption);
    captions.push(caption);
  }
  return captions;
}

const zoneInset = 14;
const minSpacing = 24;

function randomFrom(seed: string): () => number {
  let state = 2166136261;
  for (const char of seed) {
    state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  }
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function distance(a: AnimationPoint, b: AnimationPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distanceToSegment(point: AnimationPoint, start: AnimationPoint, end: AnimationPoint): number {
  const length = distance(start, end) ** 2;
  if (length === 0) {
    return distance(point, start);
  }
  const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) / length));
  return distance(point, { x: start.x + ratio * (end.x - start.x), y: start.y + ratio * (end.y - start.y) });
}

function unit(from: AnimationPoint, to: AnimationPoint): AnimationPoint {
  const length = distance(from, to) || 1;
  return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
}

function shift(point: AnimationPoint, direction: AnimationPoint, length: number): AnimationPoint {
  return { x: point.x + direction.x * length, y: point.y + direction.y * length };
}

function between(from: AnimationPoint, to: AnimationPoint, ratio: number): AnimationPoint {
  return { x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio };
}

function jitter(point: AnimationPoint, random: () => number, reach: number): AnimationPoint {
  const angle = random() * Math.PI * 2;
  return shift(point, { x: Math.cos(angle), y: Math.sin(angle) }, reach);
}

function clampToZone(point: AnimationPoint, zone: DiagramZone): AnimationPoint {
  return {
    x: Math.max(zone.x + zoneInset, Math.min(zone.x + zone.width - zoneInset, point.x)),
    y: Math.max(zone.y + zoneInset, Math.min(zone.y + zone.height - zoneInset, point.y)),
  };
}

function zoneCenter(zone: DiagramZone): AnimationPoint {
  return { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 };
}

function nearestZone(token: DiagramToken, zones: readonly DiagramZone[]): DiagramZone {
  return zones.reduce((best, zone) => (distance(token, zoneCenter(zone)) < distance(token, zoneCenter(best)) ? zone : best));
}

interface ZoneGroup {
  zone: DiagramZone;
  attackers: DiagramToken[];
  defenders: DiagramToken[];
  goalkeepers: DiagramToken[];
  carrierId: string | null;
  previousCarrierId: string | null;
  // Porteurs d'un ballon en conduite.
  dribblers: string[];
  // Défenseur qui vient de récupérer le ballon (pressing).
  defenderCarrierId: string | null;
  // But attaqué (gardien adverse ou bord de la zone) et but visé en contre-attaque.
  attackGoal: AnimationPoint;
  defenseGoal: AnimationPoint;
  attackGoalKind: "goal" | "miniGoal";
  defenseGoalKind: "goal" | "miniGoal";
  forward: AnimationPoint;
}

interface StepContext {
  group: ZoneGroup;
  index: number;
  random: () => number;
  home: Readonly<Record<string, AnimationPoint>>;
  positions: Readonly<Record<string, AnimationPoint>>;
  targets: Record<string, AnimationPoint>;
  balls: AnimationBall[];
  pressers: Array<{ id: string; targetId: string }>;
  active: string[];
  // Un ballon pour deux : le porteur conduit puis donne.
  handoff: boolean;
  // Approche du but balle au pied plutôt qu'en passes.
  soloApproach: boolean;
  // La récupération se termine par un tir.
  scoresOnCounter: boolean;
}

function place(context: StepContext, id: string, point: AnimationPoint): void {
  context.targets[id] = clampToZone(point, context.group.zone);
}

function shortSide(zone: DiagramZone): number {
  return Math.min(zone.width, zone.height);
}

function progress(group: ZoneGroup, point: AnimationPoint): number {
  const center = zoneCenter(group.zone);
  return (point.x - center.x) * group.forward.x + (point.y - center.y) * group.forward.y;
}

// Distance qu'un joueur peut parcourir dans une direction avant le bord de la zone.
function roomAhead(group: ZoneGroup, point: AnimationPoint, direction = group.forward): number {
  const { zone } = group;
  const limits = [
    direction.x > 0 ? (zone.x + zone.width - zoneInset - point.x) / direction.x : direction.x < 0 ? (zone.x + zoneInset - point.x) / direction.x : Infinity,
    direction.y > 0 ? (zone.y + zone.height - zoneInset - point.y) / direction.y : direction.y < 0 ? (zone.y + zoneInset - point.y) / direction.y : Infinity,
  ];
  return Math.max(0, Math.min(...limits));
}

function nearestTo(tokens: readonly DiagramToken[], positions: Readonly<Record<string, AnimationPoint>>, point: AnimationPoint): DiagramToken | undefined {
  return [...tokens].sort((a, b) => distance(positions[a.id]!, point) - distance(positions[b.id]!, point))[0];
}

function clearance(context: StepContext, fromId: string, toId: string): number {
  const { positions, group } = context;
  return group.defenders.reduce((closest, defender) => Math.min(closest, distanceToSegment(positions[defender.id]!, positions[fromId]!, positions[toId]!)), 80);
}

function moveAll(context: StepContext, tokens: readonly DiagramToken[], reach: number, direction?: AnimationPoint, advance = 0): void {
  for (const token of tokens) {
    const point = jitter(context.positions[token.id]!, context.random, reach);
    place(context, token.id, direction ? shift(point, direction, advance) : point);
  }
}

function pass(context: StepContext, fromId: string, toId: string, kind: "pass" | "steal" = "pass"): void {
  context.balls.push({ kind, fromId, toId, target: null });
  context.active.push(fromId, toId);
}

function dribble(context: StepContext, id: string): void {
  context.balls.push({ kind: "dribble", fromId: id, toId: id, target: null });
  context.active.push(id);
}

// Le tir part dans la cage dessinée, à côté du gardien.
function shoot(context: StepContext, shooterId: string, goal: AnimationPoint, kind: "goal" | "miniGoal"): void {
  const start = context.positions[shooterId]!;
  place(context, shooterId, shift(start, unit(start, goal), 10));
  const facing = unit(goal, zoneCenter(context.group.zone));
  const target = shift(goal, { x: -facing.y, y: facing.x }, (context.random() < 0.5 ? -1 : 1) * (goalWidths[kind] / 2 - 6));
  context.balls.push({ kind: "shot", fromId: shooterId, toId: null, target });
  context.active.push(shooterId);
}

// Le plus proche presse le porteur, le deuxième ferme la passe vers le soutien, les autres resserrent.
function defend(context: StepContext, holderId: string, supportId: string | null, intensity = 1): void {
  const { group, positions, targets } = context;
  const ball = targets[holderId] ?? positions[holderId]!;
  const chasers = [...group.defenders].sort((a, b) => distance(positions[a.id]!, ball) - distance(positions[b.id]!, ball));
  chasers.forEach((defender, rank) => {
    const point = positions[defender.id]!;
    if (rank === 0) {
      const gap = Math.max(distance(point, ball), 1);
      const ratio = Math.max(0, (gap - minSpacing) / gap) * intensity;
      place(context, defender.id, between(point, ball, ratio));
      context.pressers.push({ id: defender.id, targetId: holderId });
      context.active.push(defender.id);
    } else if (rank === 1 && supportId) {
      place(context, defender.id, between(ball, targets[supportId] ?? positions[supportId]!, 0.5));
      context.active.push(defender.id);
    } else {
      place(context, defender.id, between(point, ball, 0.3 * intensity));
    }
  });
}

function regroup(context: StepContext, nextCarrierId: string | null): void {
  const { group } = context;
  for (const token of [...group.attackers, ...group.defenders]) {
    place(context, token.id, jitter(context.home[token.id]!, context.random, 4));
  }
  group.previousCarrierId = null;
  group.defenderCarrierId = null;
  group.carrierId = nextCarrierId;
  if (nextCarrierId) {
    dribble(context, nextCarrierId);
  }
}

function backmostAttacker(context: StepContext, exceptId: string | null): string | null {
  const { group, home } = context;
  const options = group.attackers.filter((token) => token.id !== exceptId);
  return options.sort((a, b) => progress(group, home[a.id]!) - progress(group, home[b.id]!))[0]?.id ?? group.attackers[0]?.id ?? null;
}

// Conservation : le porteur sert le partenaire le plus libre, le défenseur le plus proche presse.
function possessionStep(context: StepContext): void {
  const { group, positions, random } = context;
  const carrierId = group.carrierId;
  const candidates = group.attackers.filter((token) => token.id !== carrierId);
  if (!carrierId || candidates.length === 0) {
    return;
  }
  const options = candidates.filter((token) => token.id !== group.previousCarrierId || candidates.length === 1);
  const ranked = options.map((token) => ({ token, score: clearance(context, carrierId, token.id) + random() * 30 })).sort((a, b) => b.score - a.score);
  const receiver = ranked[0]!.token;
  const support = ranked[1]?.token ?? null;
  for (const attacker of group.attackers) {
    const reach = attacker.id === receiver.id ? 14 : attacker.id === carrierId ? 32 : 26;
    place(context, attacker.id, jitter(positions[attacker.id]!, random, reach));
  }
  defend(context, receiver.id, support?.id ?? null);
  pass(context, carrierId, receiver.id);
  if (support) {
    context.active.push(support.id);
  }
  group.previousCarrierId = carrierId;
  group.carrierId = receiver.id;
}

// Passe au partenaire suivant, puis suis ta passe.
function passAndMoveStep(context: StepContext): void {
  const { group, positions } = context;
  const carrierId = group.carrierId;
  if (!carrierId || group.attackers.length < 2) {
    return;
  }
  const order = group.attackers;
  const receiver = order[(order.findIndex((token) => token.id === carrierId) + 1) % order.length]!;
  moveAll(context, group.attackers, 8);
  const receiverPoint = positions[receiver.id]!;
  place(context, receiver.id, shift(receiverPoint, unit(receiverPoint, positions[carrierId]!), 8));
  place(context, carrierId, between(positions[carrierId]!, receiverPoint, 0.7));
  if (group.defenders.length > 0) {
    defend(context, receiver.id, null, 0.6);
  }
  pass(context, carrierId, receiver.id);
  group.previousCarrierId = carrierId;
  group.carrierId = receiver.id;
}

// Conduite : chacun avance balle au pied jusqu'à la ligne puis revient ; avec un ballon pour deux,
// le porteur conduit puis donne à un partenaire libre. Les défenseurs poursuivent les porteurs.
function dribblingStep(context: StepContext): void {
  const { group, positions, home, random, index } = context;
  if (group.attackers.length === 0) {
    return;
  }
  if (group.dribblers.length === 0) {
    group.dribblers = group.attackers.filter((_, rank) => !context.handoff || rank % 2 === 0).map((token) => token.id);
  }
  if (context.handoff && index % 2 === 1) {
    moveAll(context, group.attackers, 10);
    const free = group.attackers.filter((token) => !group.dribblers.includes(token.id)).map((token) => token.id);
    const receivers: string[] = [];
    for (const id of group.dribblers) {
      const receiver = free
        .filter((candidate) => !receivers.includes(candidate))
        .sort((a, b) => distance(positions[id]!, positions[a]!) - distance(positions[id]!, positions[b]!))[0];
      if (receiver) {
        receivers.push(receiver);
        pass(context, id, receiver);
      } else {
        dribble(context, id);
      }
    }
    group.dribblers = receivers.length > 0 ? receivers : group.dribblers;
  } else if (context.handoff) {
    moveAll(
      context,
      group.attackers.filter((token) => !group.dribblers.includes(token.id)),
      12,
    );
    for (const id of group.dribblers) {
      place(context, id, jitter(positions[id]!, random, 34));
      dribble(context, id);
    }
  } else {
    const fractions = [1 / 3, 2 / 3, 1, 1, 0.5, 0];
    const fraction = fractions[index] ?? 0;
    const side = { x: -group.forward.y, y: group.forward.x };
    const zigzag = fraction > 0 && fraction < 1 ? (index % 2 === 0 ? 8 : -8) : 0;
    for (const id of group.dribblers) {
      const start = home[id]!;
      place(context, id, shift(shift(start, group.forward, roomAhead(group, start) * fraction), side, zigzag));
      dribble(context, id);
    }
  }
  for (const defender of group.defenders) {
    const point = positions[defender.id]!;
    const prey = group.dribblers.reduce<string | null>(
      (best, id) => (best === null || distance(point, context.targets[id]!) < distance(point, context.targets[best]!) ? id : best),
      null,
    );
    if (prey) {
      place(context, defender.id, between(point, context.targets[prey]!, 0.45));
      context.pressers.push({ id: defender.id, targetId: prey });
      context.active.push(defender.id);
    }
  }
}

// Passe vers l'avant (ou vers la zone de frappe), et le passeur dépasse le receveur.
function forwardPass(context: StepContext, towardGoal: boolean): void {
  const { group, positions, random } = context;
  const carrierId = group.carrierId;
  const candidates = group.attackers.filter((token) => token.id !== carrierId);
  if (!carrierId || candidates.length === 0) {
    return;
  }
  const options = candidates.filter((token) => token.id !== group.previousCarrierId || candidates.length === 1);
  const receiver = options
    .map((token) => ({
      token,
      score:
        (towardGoal ? -distance(positions[token.id]!, group.attackGoal) : progress(group, positions[token.id]!)) +
        clearance(context, carrierId, token.id) * 0.4 +
        random() * 12,
    }))
    .sort((a, b) => b.score - a.score)[0]!.token;
  const step = shortSide(group.zone) * 0.14;
  moveAll(context, group.attackers, 8, group.forward, step);
  if (towardGoal) {
    const spot = shift(group.attackGoal, unit(group.attackGoal, zoneCenter(group.zone)), shortSide(group.zone) * 0.35);
    place(context, receiver.id, between(positions[receiver.id]!, spot, 0.6));
  } else {
    place(context, receiver.id, shift(positions[receiver.id]!, group.forward, step * 1.6));
  }
  place(context, carrierId, shift(context.targets[receiver.id]!, group.forward, 26));
  defend(context, receiver.id, carrierId);
  pass(context, carrierId, receiver.id);
  group.previousCarrierId = carrierId;
  group.carrierId = receiver.id;
}

// Passes vers l'avant, puis franchissement de la ligne balle au pied ; deux attaques de suite.
function progressionStep(context: StepContext): void {
  const { group, positions, index } = context;
  if (index === 3) {
    regroup(context, backmostAttacker(context, null));
    return;
  }
  if (index === 2 || index === 5) {
    const carrierId = group.carrierId;
    if (!carrierId) {
      return;
    }
    moveAll(context, group.attackers, 6, group.forward, shortSide(group.zone) * 0.1);
    place(context, carrierId, shift(positions[carrierId]!, group.forward, roomAhead(group, positions[carrierId]!)));
    defend(context, carrierId, null);
    dribble(context, carrierId);
    return;
  }
  forwardPass(context, false);
}

// Approche (passes ou conduite) puis tir, deux fois.
function finishingStep(context: StepContext): void {
  const { group, positions, index } = context;
  if (index === 3) {
    regroup(context, backmostAttacker(context, group.carrierId));
    return;
  }
  const carrierId = group.carrierId;
  if (!carrierId) {
    return;
  }
  if (index === 2 || index === 5) {
    moveAll(
      context,
      group.attackers.filter((token) => token.id !== carrierId),
      6,
      group.forward,
      10,
    );
    shoot(context, carrierId, group.attackGoal, group.attackGoalKind);
    defend(context, carrierId, null);
    return;
  }
  if (context.soloApproach) {
    moveAll(
      context,
      group.attackers.filter((token) => token.id !== carrierId),
      6,
    );
    const start = positions[carrierId]!;
    const direction = unit(start, group.attackGoal);
    place(context, carrierId, shift(start, direction, Math.min(shortSide(group.zone) * 0.3, roomAhead(group, start, direction))));
    defend(context, carrierId, null);
    dribble(context, carrierId);
    return;
  }
  forwardPass(context, index === 1 || index === 4);
}

// Pressing : passes, pression et fermeture de la passe, récupération, contre-attaque, puis tir ou
// reprise du ballon par les attaquants.
function pressingStep(context: StepContext): void {
  const { group, positions, index } = context;
  if (group.defenders.length === 0 || index <= 1) {
    possessionStep(context);
    return;
  }
  const counter = unit(zoneCenter(group.zone), group.defenseGoal);
  if (index === 2) {
    const carrierId = group.carrierId;
    if (!carrierId) {
      return;
    }
    const ball = positions[carrierId]!;
    const presser = nearestTo(group.defenders, positions, ball)!;
    moveAll(context, group.attackers, 6);
    moveAll(
      context,
      group.defenders.filter((token) => token.id !== presser.id),
      6,
      counter,
      14,
    );
    place(context, presser.id, shift(ball, unit(ball, positions[presser.id]!), minSpacing));
    context.pressers.push({ id: presser.id, targetId: carrierId });
    pass(context, carrierId, presser.id, "steal");
    group.defenderCarrierId = presser.id;
    group.carrierId = null;
    return;
  }
  if (index === 5) {
    regroup(context, group.carrierId ?? group.attackers[0]?.id ?? null);
    return;
  }
  const holderId = group.defenderCarrierId;
  if (!holderId) {
    possessionStep(context);
    return;
  }
  if (index === 3) {
    const step = shortSide(group.zone) * 0.18;
    moveAll(context, group.defenders, 6, counter, step);
    const receiver = nearestTo(
      group.defenders.filter((token) => token.id !== holderId),
      positions,
      group.defenseGoal,
    );
    if (receiver) {
      place(context, receiver.id, shift(positions[receiver.id]!, counter, step * 1.5));
      pass(context, holderId, receiver.id);
      group.defenderCarrierId = receiver.id;
    } else {
      dribble(context, holderId);
    }
    // À la perte, l'attaquant le plus proche presse aussitôt.
    moveAll(context, group.attackers, 8);
    const ball = context.targets[group.defenderCarrierId!]!;
    const chaser = nearestTo(group.attackers, positions, ball);
    if (chaser) {
      place(context, chaser.id, between(positions[chaser.id]!, ball, 0.6));
      context.pressers.push({ id: chaser.id, targetId: group.defenderCarrierId! });
      context.active.push(chaser.id);
    }
    return;
  }
  moveAll(context, group.attackers, 8);
  if (context.scoresOnCounter) {
    moveAll(
      context,
      group.defenders.filter((token) => token.id !== holderId),
      6,
      counter,
      10,
    );
    shoot(context, holderId, group.defenseGoal, group.defenseGoalKind);
    group.defenderCarrierId = null;
    return;
  }
  const ball = positions[holderId]!;
  const winner = nearestTo(group.attackers, positions, ball);
  moveAll(context, group.defenders, 6);
  if (winner) {
    place(context, winner.id, shift(ball, unit(ball, positions[winner.id]!), minSpacing));
    context.pressers.push({ id: winner.id, targetId: holderId });
    pass(context, holderId, winner.id, "steal");
    group.carrierId = winner.id;
  }
  group.defenderCarrierId = null;
}

const scenarioSteps: Record<ExerciseScenario, (context: StepContext) => void> = {
  possession: possessionStep,
  passAndMove: passAndMoveStep,
  dribbling: dribblingStep,
  progression: progressionStep,
  finishing: finishingStep,
  pressing: pressingStep,
};

// Écarte les joueurs de champ trop proches pour qu'aucun ne se superpose à l'arrivée.
function spreadOut(group: ZoneGroup, targets: Record<string, AnimationPoint>): void {
  const players = [...group.attackers, ...group.defenders];
  for (let pass = 0; pass < 3; pass += 1) {
    for (let i = 0; i < players.length; i += 1) {
      for (let j = i + 1; j < players.length; j += 1) {
        const a = targets[players[i]!.id]!;
        const b = targets[players[j]!.id]!;
        const gap = distance(a, b);
        if (gap < minSpacing) {
          const angle = gap === 0 ? i + j : Math.atan2(b.y - a.y, b.x - a.x);
          const shift = (minSpacing - gap) / 2;
          targets[players[i]!.id] = clampToZone({ x: a.x - Math.cos(angle) * shift, y: a.y - Math.sin(angle) * shift }, group.zone);
          targets[players[j]!.id] = clampToZone({ x: b.x + Math.cos(angle) * shift, y: b.y + Math.sin(angle) * shift }, group.zone);
        }
      }
    }
  }
}

// Le gardien se décale vers le ballon de sa zone, sans quitter sa ligne de plus de quelques pas.
function placeKeepers(context: StepContext, groupBalls: readonly AnimationBall[]): void {
  const last = groupBalls[groupBalls.length - 1];
  const ball = last ? (last.target ?? context.targets[last.toId ?? last.fromId]) : undefined;
  for (const keeper of context.group.goalkeepers) {
    const base = context.home[keeper.id]!;
    context.targets[keeper.id] = ball ? shift(base, unit(base, ball), Math.min(12, distance(base, ball) * 0.15)) : base;
  }
}

const goalWidths = { goal: 46, miniGoal: 26 } as const;
// La cage se dessine juste derrière le gardien.
const keeperToGoalLine = 8;

function usesMiniGoals(exercise: AnimatedExercise): boolean {
  return /mini-but|petits? buts?/.test(lower(exercise.organization, exercise.instruction, ...(exercise.rules ?? [])));
}

// Point du bord de la zone dans une direction donnée depuis son centre.
function edgePoint(zone: DiagramZone, direction: AnimationPoint): AnimationPoint {
  const center = zoneCenter(zone);
  const reach = Math.min(
    direction.x === 0 ? Infinity : zone.width / 2 / Math.abs(direction.x),
    direction.y === 0 ? Infinity : zone.height / 2 / Math.abs(direction.y),
  );
  return shift(center, direction, reach);
}

function goalBehind(keeper: DiagramToken | undefined, zone: DiagramZone, fallback: AnimationPoint): AnimationPoint {
  if (!keeper) {
    return edgePoint(zone, fallback);
  }
  return shift(keeper, unit(zoneCenter(zone), keeper), keeperToGoalLine);
}

function buildGroups(diagram: AnimatedExercise["diagram"], miniGoals: boolean): ZoneGroup[] {
  const zones: readonly DiagramZone[] = diagram.zones.length > 0 ? diagram.zones : [{ x: 0, y: 0, width: diagram.width, height: diagram.height }];
  return zones.map((zone) => {
    const tokens = diagram.tokens.filter((token) => nearestZone(token, zones) === zone);
    const goalkeepers = tokens.filter((token) => token.role === "goalkeeper").sort((a, b) => b.x - a.x);
    const center = zoneCenter(zone);
    const attackKeeper = goalkeepers[0];
    const defenseKeeper = goalkeepers.length > 1 ? goalkeepers[goalkeepers.length - 1] : undefined;
    const attackGoal = goalBehind(attackKeeper, zone, { x: 1, y: 0 });
    const attackers = tokens.filter((token) => token.role === "attacker");
    return {
      zone,
      attackers,
      defenders: tokens.filter((token) => token.role === "defender"),
      goalkeepers,
      carrierId: attackers[0]?.id ?? null,
      previousCarrierId: null,
      dribblers: [],
      defenderCarrierId: null,
      attackGoal,
      defenseGoal: goalBehind(defenseKeeper, zone, { x: -1, y: 0 }),
      attackGoalKind: attackKeeper || !miniGoals ? "goal" : "miniGoal",
      defenseGoalKind: defenseKeeper || !miniGoals ? "goal" : "miniGoal",
      forward: unit(center, attackGoal),
    };
  });
}

export type DiagramTargetKind = "goal" | "miniGoal" | "gate" | "line" | "cone" | "plot";

// Repère dessiné sur le terrain : but, mini-but, porte (deux cônes), ligne à franchir, cône ou plot.
export interface DiagramTarget {
  readonly kind: DiagramTargetKind;
  readonly center: AnimationPoint;
  // Direction vers le terrain : le filet d'un but est dessiné de l'autre côté.
  readonly facing: AnimationPoint;
  readonly width: number;
}

export interface TargetGeometry {
  // Montants du but, plots de la porte ou extrémités de la ligne.
  readonly a: AnimationPoint;
  readonly b: AnimationPoint;
  // Fond du filet (confondu avec a et b pour une porte ou une ligne).
  readonly backA: AnimationPoint;
  readonly backB: AnimationPoint;
}

export function targetGeometry(target: DiagramTarget): TargetGeometry {
  const axis = { x: -target.facing.y, y: target.facing.x };
  const a = shift(target.center, axis, target.width / 2);
  const b = shift(target.center, axis, -target.width / 2);
  const depth = target.kind === "goal" ? 9 : target.kind === "miniGoal" ? 6 : 0;
  return { a, b, backA: shift(a, target.facing, -depth), backB: shift(b, target.facing, -depth) };
}

function goalTarget(kind: "goal" | "miniGoal", goal: AnimationPoint, zone: DiagramZone): DiagramTarget {
  return { kind, center: goal, facing: unit(goal, zoneCenter(zone)), width: goalWidths[kind] };
}

// Deux portes ou une ligne sur le bord attaqué.
function edgeTargets(group: ZoneGroup, gates: boolean): DiagramTarget[] {
  const facing = { x: -group.forward.x, y: -group.forward.y };
  const center = edgePoint(group.zone, group.forward);
  const side = Math.abs(group.forward.x) > Math.abs(group.forward.y) ? group.zone.height : group.zone.width;
  if (!gates) {
    return [{ kind: "line", center, facing, width: side - 2 * zoneInset }];
  }
  const axis = { x: -facing.y, y: facing.x };
  return [-1, 1].map((sign) => ({ kind: "gate" as const, center: shift(center, axis, (sign * side) / 4), facing, width: 22 }));
}

// Cibles de l'exercice : là où va le ballon dans l'animation (but, portes, ligne d'en-but).
export function diagramTargets(exercise: AnimatedExercise): readonly DiagramTarget[] {
  const scenario = exerciseScenario(exercise);
  const all = lower(exercise.title, exercise.organization, exercise.instruction, ...(exercise.rules ?? []));
  const gates = /\bportes?\b/.test(all);
  const scoresOnCounter = finishingWords.test(withoutGoalLines(lower(exercise.organization, exercise.instruction, ...(exercise.rules ?? []))));
  const targets: DiagramTarget[] = [];
  for (const group of buildGroups(exercise.diagram, usesMiniGoals(exercise))) {
    const attackGoal = goalTarget(group.attackGoalKind, group.attackGoal, group.zone);
    const defenseGoal = goalTarget(group.defenseGoalKind, group.defenseGoal, group.zone);
    if (scenario === "finishing") {
      targets.push(attackGoal);
      if (exercise.kind === "game") {
        targets.push(defenseGoal);
      }
    } else if (scenario === "pressing") {
      if (scoresOnCounter) {
        targets.push(defenseGoal);
        if (exercise.kind === "game") {
          targets.push(attackGoal);
        }
      } else if (gates || /ligne|zone de marque|en-but/.test(all)) {
        targets.push(...edgeTargets(group, gates));
      }
    } else if (scenario === "progression" || (scenario === "dribbling" && /ligne|plots?/.test(all))) {
      targets.push(...edgeTargets(group, gates));
    } else if (scenario === "possession" && gates) {
      for (const direction of [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ]) {
        targets.push({ kind: "gate", center: edgePoint(group.zone, direction), facing: { x: -direction.x, y: -direction.y }, width: 22 });
      }
    } else if (scenario === "passAndMove" && gates && group.attackers.length > 1) {
      // Une porte entre chaque partenaire : la passe la traverse.
      group.attackers.forEach((token, index) => {
        const next = group.attackers[(index + 1) % group.attackers.length]!;
        targets.push({ kind: "gate", center: between(token, next, 0.5), facing: unit(token, next), width: 20 });
      });
    }
    targets.push(...conesFor(exercise, group, targets));
  }
  return targets;
}

// Cône (haut, pour délimiter) ou plot (coupelle plate, pour baliser un parcours).
function marker(center: AnimationPoint, kind: "cone" | "plot" = "plot"): DiagramTarget {
  return { kind, center, facing: { x: 0, y: -1 }, width: 0 };
}

// Rangée de plots dans l'axe du jeu, décalée de `offset` sur le côté.
function coneRow(group: ZoneGroup, count: number, offset: number): DiagramTarget[] {
  const center = zoneCenter(group.zone);
  const side = { x: -group.forward.y, y: group.forward.x };
  const length = Math.abs(group.forward.x) > Math.abs(group.forward.y) ? group.zone.width : group.zone.height;
  return Array.from({ length: count }, (_, index) =>
    marker(shift(shift(center, group.forward, (index / (count - 1) - 0.5) * (length - 4 * zoneInset)), side, offset)),
  );
}

// Plots de l'organisation : délimitation de la zone (matériel « Cônes » ou « Plots »), puis les
// dispositions décrites dans la fiche (étoile, plot central, ligne de plots, coins du but…).
function conesFor(exercise: AnimatedExercise, group: ZoneGroup, targets: readonly DiagramTarget[]): DiagramTarget[] {
  const organization = lower(exercise.organization, exercise.instruction, ...(exercise.rules ?? []));
  const equipment = lower(...(exercise.equipment ?? []));
  const { zone } = group;
  const cones: DiagramTarget[] = [];
  if (/cône|plot/.test(equipment) || /\bplots?\b/.test(organization)) {
    const corner = /cône/.test(equipment) ? "cone" : "plot";
    for (const x of [zone.x, zone.x + zone.width]) {
      for (const y of [zone.y, zone.y + zone.height]) {
        cones.push(marker({ x, y }, corner));
      }
    }
  }
  const center = zoneCenter(zone);
  if (/étoile|joueur par plot|plot suivant/.test(organization)) {
    for (const token of group.attackers) {
      cones.push(marker(shift(token, unit(center, token), 17)));
    }
  }
  if (/plot central/.test(organization)) {
    cones.push(marker(center));
  }
  const side = Math.abs(group.forward.x) > Math.abs(group.forward.y) ? zone.height : zone.width;
  if (/deux lignes de plots/.test(organization)) {
    cones.push(...coneRow(group, 4, -side / 4), ...coneRow(group, 4, side / 4));
  } else if (/ligne de plots|slalom|plots tous les/.test(organization)) {
    cones.push(...coneRow(group, 5, 0));
  }
  if (/ligne des plots/.test(organization)) {
    const axis = { x: -group.forward.y, y: group.forward.x };
    const mark = shift(center, group.forward, side * 0.2);
    cones.push(...[-1.5, -0.5, 0.5, 1.5].map((step) => marker(shift(mark, axis, (step * side) / 5))));
  }
  if (/coins du but/.test(organization)) {
    for (const goal of targets.filter((target) => target.kind === "goal" || target.kind === "miniGoal")) {
      const { a, b } = targetGeometry(goal);
      cones.push(marker(between(a, goal.center, 0.15)), marker(between(b, goal.center, 0.15)));
    }
  }
  if (/presse un plot/.test(organization)) {
    cones.push(
      ...[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([dx, dy]) => marker({ x: center.x + (dx! * zone.width) / 4, y: center.y + (dy! * zone.height) / 4 })),
    );
  }
  return cones;
}

export interface BallFrame {
  readonly ball: AnimationPoint;
  // Joueur entouré : le porteur, puis le receveur une fois le ballon arrivé.
  readonly holder: AnimationPoint | null;
  // Trajet tracé en pointillés (passe ou tir) ; aucun pour une conduite ou une récupération.
  readonly trail: { readonly from: AnimationPoint; readonly to: AnimationPoint } | null;
}

// Position du ballon à un instant de l'étape (`ratio` de 0 à 1), commune aux lecteurs web et Coach.
export function ballFrame(ball: AnimationBall, at: (id: string) => AnimationPoint, ratio: number): BallFrame {
  const from = at(ball.fromId);
  if (ball.kind === "dribble") {
    return { ball: from, holder: from, trail: null };
  }
  const to = ball.toId ? at(ball.toId) : (ball.target ?? from);
  return {
    ball: between(from, to, ratio),
    holder: ratio < 1 ? from : ball.toId ? to : null,
    trail: ball.kind === "steal" ? null : { from, to },
  };
}

export function buildDiagramAnimation(exercise: AnimatedExercise, seed: string): readonly AnimationStep[] {
  const random = randomFrom(seed);
  const scenario = exerciseScenario(exercise);
  const captions = captionsFor(exercise, scenario);
  const groups = buildGroups(exercise.diagram, usesMiniGoals(exercise));
  const head = lower(exercise.organization, exercise.instruction);
  const handoff = /pour deux/.test(head) && /donne|passe/.test(lower(exercise.instruction));
  const soloApproach = soloApproachWords.test(head);
  const scoresOnCounter = finishingWords.test(withoutGoalLines(lower(exercise.organization, exercise.instruction, ...(exercise.rules ?? []))));
  const home: Record<string, AnimationPoint> = Object.fromEntries(exercise.diagram.tokens.map((token) => [token.id, { x: token.x, y: token.y }]));
  let positions: Record<string, AnimationPoint> = { ...home };
  const steps: AnimationStep[] = [];

  for (let index = 0; index < diagramAnimationStepCount; index += 1) {
    const targets: Record<string, AnimationPoint> = { ...positions };
    const balls: AnimationBall[] = [];
    const pressers: Array<{ id: string; targetId: string }> = [];
    const active: string[] = [];

    for (const group of groups) {
      const groupBalls: AnimationBall[] = [];
      const context: StepContext = {
        group,
        index,
        random,
        home,
        positions,
        targets,
        balls: groupBalls,
        pressers,
        active,
        handoff,
        soloApproach,
        scoresOnCounter,
      };
      scenarioSteps[scenario](context);
      spreadOut(group, targets);
      placeKeepers(context, groupBalls);
      balls.push(...groupBalls);
    }

    steps.push({ caption: captions[index]!, from: positions, to: targets, balls, pressers, activeIds: [...new Set(active)] });
    positions = targets;
  }

  return steps;
}
