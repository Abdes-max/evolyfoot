import type { DiagramToken, DiagramZone, TacticalDiagram } from "./training-session";

// Animation d'un schéma, calculée à partir de ses joueurs : un même exercice rejoue toujours la
// même séquence, sans rien à stocker. C'est une illustration du rythme de jeu (passe, soutien,
// pressing), pas une chorégraphie écrite exercice par exercice.
export interface AnimationPoint {
  readonly x: number;
  readonly y: number;
}

export interface AnimationPass {
  readonly fromId: string;
  readonly toId: string;
}

export interface AnimationStep {
  readonly caption: string;
  readonly from: Readonly<Record<string, AnimationPoint>>;
  readonly to: Readonly<Record<string, AnimationPoint>>;
  // Une passe par zone de jeu.
  readonly passes: readonly AnimationPass[];
  readonly pressers: ReadonlyArray<{ readonly id: string; readonly targetId: string }>;
  // Joueurs au cœur de l'action, les autres sont estompés.
  readonly activeIds: readonly string[];
}

export const diagramAnimationStepCount = 6;

const opposedCaptions = [
  "Le porteur cherche une solution libre",
  "La passe sort de la pression",
  "Les partenaires se rendent disponibles",
  "Le plus proche presse le porteur",
  "Le bloc se resserre autour du ballon",
  "Le ballon repart vers le côté libre",
];

const freeCaptions = [
  "Passe et déplacement",
  "Le partenaire se propose",
  "Le ballon circule",
  "Nouvelle ligne de passe",
  "Passe et suit",
  "Le groupe garde son rythme",
];

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

function clampToZone(point: AnimationPoint, zone: DiagramZone): AnimationPoint {
  return {
    x: Math.max(zone.x + zoneInset, Math.min(zone.x + zone.width - zoneInset, point.x)),
    y: Math.max(zone.y + zoneInset, Math.min(zone.y + zone.height - zoneInset, point.y)),
  };
}

function nearestZone(token: DiagramToken, zones: readonly DiagramZone[]): DiagramZone {
  const center = (zone: DiagramZone) => ({ x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 });
  return zones.reduce((best, zone) => (distance(token, center(zone)) < distance(token, center(best)) ? zone : best));
}

interface ZoneGroup {
  zone: DiagramZone;
  attackers: DiagramToken[];
  defenders: DiagramToken[];
  goalkeepers: DiagramToken[];
  carrierId: string | null;
  previousCarrierId: string | null;
}

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

export function buildDiagramAnimation(diagram: TacticalDiagram, seed: string): readonly AnimationStep[] {
  const random = randomFrom(seed);
  const zones: readonly DiagramZone[] = diagram.zones.length > 0 ? diagram.zones : [{ x: 0, y: 0, width: diagram.width, height: diagram.height }];
  const groups: ZoneGroup[] = zones.map((zone) => ({ zone, attackers: [], defenders: [], goalkeepers: [], carrierId: null, previousCarrierId: null }));
  for (const token of diagram.tokens) {
    const group = groups.find((candidate) => candidate.zone === nearestZone(token, zones))!;
    (token.role === "attacker" ? group.attackers : token.role === "defender" ? group.defenders : group.goalkeepers).push(token);
  }
  for (const group of groups) {
    group.carrierId = group.attackers[0]?.id ?? null;
  }

  const opposed = groups.some((group) => group.defenders.length > 0);
  const captions = opposed ? opposedCaptions : freeCaptions;
  let positions: Record<string, AnimationPoint> = Object.fromEntries(diagram.tokens.map((token) => [token.id, { x: token.x, y: token.y }]));
  const steps: AnimationStep[] = [];

  for (let index = 0; index < diagramAnimationStepCount; index += 1) {
    const targets: Record<string, AnimationPoint> = { ...positions };
    const passes: AnimationPass[] = [];
    const pressers: Array<{ id: string; targetId: string }> = [];
    const activeIds: string[] = [];

    for (const group of groups) {
      const carrierId = group.carrierId;
      const candidates = group.attackers.filter((token) => token.id !== carrierId);
      if (!carrierId || candidates.length === 0) {
        continue;
      }
      const carrierPoint = positions[carrierId]!;
      const options = candidates.filter((token) => token.id !== group.previousCarrierId || candidates.length === 1);
      const ranked = options
        .map((token) => {
          const clearance = group.defenders.reduce((closest, defender) => Math.min(closest, distanceToSegment(positions[defender.id]!, carrierPoint, positions[token.id]!)), 80);
          return { token, score: clearance + random() * 30 };
        })
        .sort((a, b) => b.score - a.score);
      const receiver = ranked[0]!.token;
      const support = ranked[1]?.token ?? null;

      for (const attacker of group.attackers) {
        const angle = random() * Math.PI * 2;
        const reach = attacker.id === receiver.id ? 14 : attacker.id === carrierId ? 32 : 26;
        const point = positions[attacker.id]!;
        targets[attacker.id] = clampToZone({ x: point.x + Math.cos(angle) * reach, y: point.y + Math.sin(angle) * reach }, group.zone);
      }

      const receiverTarget = targets[receiver.id]!;
      const chasers = [...group.defenders].sort((a, b) => distance(positions[a.id]!, receiverTarget) - distance(positions[b.id]!, receiverTarget));
      chasers.forEach((defender, rank) => {
        const point = positions[defender.id]!;
        if (rank === 0) {
          const gap = Math.max(distance(point, receiverTarget), 1);
          const ratio = Math.max(0, (gap - minSpacing) / gap);
          targets[defender.id] = clampToZone({ x: point.x + (receiverTarget.x - point.x) * ratio, y: point.y + (receiverTarget.y - point.y) * ratio }, group.zone);
          pressers.push({ id: defender.id, targetId: receiver.id });
        } else if (rank === 1 && support) {
          const supportTarget = targets[support.id]!;
          targets[defender.id] = clampToZone({ x: (receiverTarget.x + supportTarget.x) / 2, y: (receiverTarget.y + supportTarget.y) / 2 }, group.zone);
        } else {
          targets[defender.id] = clampToZone({ x: point.x + (receiverTarget.x - point.x) * 0.3, y: point.y + (receiverTarget.y - point.y) * 0.3 }, group.zone);
        }
      });
      spreadOut(group, targets);

      const center = group.zone.y + group.zone.height / 2;
      for (const keeper of group.goalkeepers) {
        targets[keeper.id] = { x: keeper.x, y: keeper.y + (targets[receiver.id]!.y - center) * 0.2 };
      }

      passes.push({ fromId: carrierId, toId: receiver.id });
      activeIds.push(carrierId, receiver.id, ...chasers.slice(0, 2).map((defender) => defender.id));
      if (support) {
        activeIds.push(support.id);
      }
      group.previousCarrierId = carrierId;
      group.carrierId = receiver.id;
    }

    steps.push({ caption: captions[index]!, from: positions, to: targets, passes, pressers, activeIds });
    positions = targets;
  }

  return steps;
}
