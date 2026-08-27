import type { DevelopmentWeek } from "./development-plan";
import type { AgeGroup, DevelopmentTheme } from "./index";

export type TrainingBlockKind = "welcome" | "activation" | "main" | "game";

export type DiagramTokenRole = "attacker" | "defender" | "goalkeeper";
export interface DiagramToken { id: string; x: number; y: number; role: DiagramTokenRole; label: string; }
export interface DiagramZone { x: number; y: number; width: number; height: number; }
export interface DiagramArrow { x1: number; y1: number; x2: number; y2: number; }
export interface TacticalDiagram { width: number; height: number; zones: DiagramZone[]; tokens: DiagramToken[]; arrows: DiagramArrow[]; }

export interface TrainingActivity {
  id: string;
  kind: TrainingBlockKind;
  title: string;
  compatibleThemes: DevelopmentTheme[];
  objective: string;
  organization: string;
  instruction: string;
  observable: string;
  rules: string[];
  coachingPoints: string[];
  equipment: string[];
  fieldSize: string;
  defenderCount: number;
  hasGoalkeeper: boolean;
  diagram: TacticalDiagram;
}
export interface TrainingBlock { id: string; activity: TrainingActivity; durationMinutes: number; }
export interface TrainingSession { id: string; title: string; ageGroup: AgeGroup; playerCount: number; theme: DevelopmentTheme; intention: string; blocks: TrainingBlock[]; }

// --- Génération des schémas tactiques ---
// La forme du schéma découle du type de bloc : les blocs d'accueil et
// d'activation sont représentés par une zone unique (rondo), les situations
// principales par deux zones jumelles, et les jeux par un terrain complet.
const DIAGRAM_WIDTH = 400;
const DIAGRAM_HEIGHT = 240;

function circlePositions(count: number, cx: number, cy: number, radius: number): Array<{ x: number; y: number }> {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    return { x: Math.round(cx + radius * Math.cos(angle)), y: Math.round(cy + radius * Math.sin(angle)) };
  });
}

function attackerTokens(spots: Array<{ x: number; y: number }>, offset = 0): DiagramToken[] {
  return spots.map((spot, index) => ({ id: `a${offset + index + 1}`, x: spot.x, y: spot.y, role: "attacker", label: String(offset + index + 1) }));
}
function defenderTokens(spots: Array<{ x: number; y: number }>, prefix: string): DiagramToken[] {
  return spots.map((spot, index) => ({ id: `${prefix}${index + 1}`, x: spot.x, y: spot.y, role: "defender", label: spots.length > 1 ? `D${index + 1}` : "D" }));
}

function singleZoneDiagram(attackers: number, defenders: number, goalkeeper: boolean): TacticalDiagram {
  const zone: DiagramZone = { x: 90, y: 40, width: 220, height: 160 };
  const center = { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 };
  const attackerSpots = circlePositions(attackers, center.x, center.y, 62);
  const defenderSpots = defenders > 0 ? circlePositions(defenders, center.x, center.y, 22) : [];
  const tokens = [...attackerTokens(attackerSpots), ...defenderTokens(defenderSpots, "d")];
  if (goalkeeper) tokens.push({ id: "g", x: zone.x + zone.width + 30, y: center.y, role: "goalkeeper", label: "G" });
  const arrows: DiagramArrow[] = attackerSpots.length >= 2
    ? [{ x1: attackerSpots[0].x, y1: attackerSpots[0].y, x2: attackerSpots[1].x, y2: attackerSpots[1].y }]
    : [];
  return { width: DIAGRAM_WIDTH, height: DIAGRAM_HEIGHT, zones: [zone], tokens, arrows };
}

function doubleZoneDiagram(attackersPerZone: number, defendersPerZone: number, goalkeeper: boolean): TacticalDiagram {
  const width = 160;
  const height = 160;
  const gap = 30;
  const zoneA: DiagramZone = { x: 40, y: 40, width, height };
  const zoneB: DiagramZone = { x: 40 + width + gap, y: 40, width, height };
  const centerA = { x: zoneA.x + width / 2, y: zoneA.y + height / 2 };
  const centerB = { x: zoneB.x + width / 2, y: zoneB.y + height / 2 };
  const attackersA = circlePositions(attackersPerZone, centerA.x, centerA.y, 52);
  const attackersB = circlePositions(attackersPerZone, centerB.x, centerB.y, 52);
  const defendersA = defendersPerZone > 0 ? circlePositions(defendersPerZone, centerA.x, centerA.y, 18) : [];
  const defendersB = defendersPerZone > 0 ? circlePositions(defendersPerZone, centerB.x, centerB.y, 18) : [];
  const tokens = [
    ...attackerTokens(attackersA),
    ...defenderTokens(defendersA, "da"),
    ...attackerTokens(attackersB, attackersPerZone),
    ...defenderTokens(defendersB, "db"),
  ];
  if (goalkeeper) tokens.push({ id: "g", x: centerB.x, y: zoneB.y + height + 18, role: "goalkeeper", label: "G" });
  const arrows: DiagramArrow[] = attackersA.length >= 2
    ? [{ x1: attackersA[0].x, y1: attackersA[0].y, x2: attackersA[1].x, y2: attackersA[1].y }]
    : [];
  return { width: DIAGRAM_WIDTH, height: DIAGRAM_HEIGHT, zones: [zoneA, zoneB], tokens, arrows };
}

function fullPitchDiagram(attackersPerSide: number, defendersPerSide: number, goalkeeper: boolean): TacticalDiagram {
  const pitch: DiagramZone = { x: 20, y: 20, width: 360, height: 200 };
  const leftCenter = { x: pitch.x + pitch.width * 0.3, y: pitch.y + pitch.height / 2 };
  const rightCenter = { x: pitch.x + pitch.width * 0.7, y: pitch.y + pitch.height / 2 };
  const left = circlePositions(attackersPerSide, leftCenter.x, leftCenter.y, 46);
  const right = circlePositions(attackersPerSide, rightCenter.x, rightCenter.y, 46);
  const defendersLeft = defendersPerSide > 0 ? circlePositions(defendersPerSide, leftCenter.x, leftCenter.y, 16) : [];
  const tokens = [
    ...attackerTokens(left),
    ...defenderTokens(defendersLeft, "d"),
    ...attackerTokens(right, attackersPerSide).map((token) => ({ ...token, role: "defender" as const })),
  ];
  if (goalkeeper) {
    tokens.push({ id: "g1", x: pitch.x + 10, y: pitch.y + pitch.height / 2, role: "goalkeeper", label: "G" });
    tokens.push({ id: "g2", x: pitch.x + pitch.width - 10, y: pitch.y + pitch.height / 2, role: "goalkeeper", label: "G" });
  }
  const arrows: DiagramArrow[] = left.length >= 1 && right.length >= 1
    ? [{ x1: left[0].x, y1: left[0].y, x2: rightCenter.x, y2: rightCenter.y }]
    : [];
  return { width: DIAGRAM_WIDTH, height: DIAGRAM_HEIGHT, zones: [pitch], tokens, arrows };
}

function buildDiagram(kind: TrainingBlockKind, defenderCount: number, hasGoalkeeper: boolean): TacticalDiagram {
  if (kind === "welcome") return singleZoneDiagram(3, defenderCount, hasGoalkeeper);
  if (kind === "activation") return singleZoneDiagram(4, defenderCount, hasGoalkeeper);
  if (kind === "main") return doubleZoneDiagram(3, defenderCount, hasGoalkeeper);
  return fullPitchDiagram(4, defenderCount, hasGoalkeeper);
}

// --- Catalogue des activités ---
type ActivityDetails = Omit<TrainingActivity, "id" | "kind" | "compatibleThemes" | "diagram">;
interface ThemeActivitySet { slug: string; welcome: ActivityDetails; activation: ActivityDetails; main: ActivityDetails[]; game: ActivityDetails; }

const themeActivitySets: Record<DevelopmentTheme, ThemeActivitySet> = {
  "Conserver le ballon": {
    slug: "conserver",
    welcome: { title: "Accueil en passes sécurisées", objective: "Installer des repères pour garder le ballon.", organization: "Binômes avec un ballon dans des portes espacées.", instruction: "Contrôle orienté puis passe dans la porte libre.", observable: "Le receveur s’oriente avant le contrôle.", rules: ["Un ballon pour deux joueurs, une porte de deux mètres par binôme.", "Le contrôle doit orienter le ballon vers la porte visée avant la passe."], coachingPoints: ["Regarder la porte avant de contrôler.", "Passe au sol, appuyée sur le bon pied."], equipment: ["Cônes"], fieldSize: "Portes espacées de 6m", defenderCount: 0, hasGoalkeeper: false },
    activation: { title: "Rondo mobile 4 contre 1", objective: "Offrir des solutions autour du porteur.", organization: "Carrés de 10 mètres, quatre attaquants et un défenseur.", instruction: "Change de côté après ta passe et garde deux solutions visibles.", observable: "Le porteur dispose de deux partenaires démarqués.", rules: ["10 passes consécutives = 1 point pour les attaquants.", "Le défenseur qui touche le ballon change de place avec le passeur fautif."], coachingPoints: ["Bouger après chaque passe pour rester une solution.", "Toujours proposer un appui et une remise possibles."], equipment: ["Cônes", "Chasubles"], fieldSize: "Carré 10×10m", defenderCount: 1, hasGoalkeeper: false },
    main: [
      { title: "Conserver en deux zones", objective: "Enchaîner des passes sous pression.", organization: "Deux équipes de quatre et deux jokers dans deux zones.", instruction: "Réalise cinq passes avant de changer de zone.", observable: "L’équipe utilise la largeur et change de zone au bon moment.", rules: ["Cinq passes consécutives autorisent le changement de zone.", "Les jokers jouent toujours avec l’équipe en possession."], coachingPoints: ["Étirer le jeu en largeur avant de changer de zone.", "Accélérer la circulation dès qu’une zone est fermée."], equipment: ["Cônes", "Chasubles"], fieldSize: "Deux zones 15×15m", defenderCount: 0, hasGoalkeeper: false },
      { title: "Sortir du carré sous pression", objective: "Identifier le moment pour sécuriser ou sortir.", organization: "Jeu 4 contre 2 avec quatre portes extérieures.", instruction: "Après quatre passes, trouve un partenaire lancé dans une porte.", observable: "Les joueurs alternent soutien proche et appel extérieur.", rules: ["Quatre passes minimum avant de tenter une sortie.", "Une sortie réussie dans une porte vaut deux points."], coachingPoints: ["Garder la tête relevée pour repérer la porte libre.", "Accélérer la passe de sortie, ne pas la temporiser."], equipment: ["Cônes", "Chasubles"], fieldSize: "Carré 14×14m", defenderCount: 2, hasGoalkeeper: false },
    ],
    game: { title: "Match bonus conservation", objective: "Réinvestir la conservation en opposition.", organization: "Deux équipes, terrain large, deux mini-buts par camp.", instruction: "Un but compte double après cinq passes consécutives.", observable: "L’équipe ne force pas la progression quand elle est fermée.", rules: ["But classique = 1 point, but après cinq passes consécutives = 2 points.", "Changement de gardien toutes les cinq minutes."], coachingPoints: ["Accepter de temporiser si l’équipe est fermée.", "Chercher le décalage plutôt que la passe forcée."], equipment: ["Chasubles", "Mini-buts"], fieldSize: "Terrain réduit", defenderCount: 0, hasGoalkeeper: true },
  },
  "Progresser ensemble": {
    slug: "progresser",
    welcome: { title: "Accueil passe et avance", objective: "Associer passe et déplacement vers l’avant.", organization: "Trios en lignes avec un ballon par trio.", instruction: "Passe puis dépasse le partenaire servi.", observable: "Le passeur se remet immédiatement en mouvement.", rules: ["Chaque passe déclenche une course de soutien immédiate.", "Le trio change de sens de progression toutes les deux minutes."], coachingPoints: ["Accélérer après la passe, ne pas rester statique.", "Regarder devant avant de recevoir."], equipment: ["Cônes"], fieldSize: "Couloir 20×6m", defenderCount: 0, hasGoalkeeper: false },
    activation: { title: "Appuis en mouvement", objective: "Créer une solution devant et une solution proche.", organization: "Losanges de quatre joueurs avec un ballon.", instruction: "Regarde devant, joue puis change de ligne.", observable: "Le porteur reçoit une solution vers l’avant.", rules: ["Le porteur doit toujours avoir une solution devant et une solution proche.", "Changement de ligne obligatoire après chaque passe."], coachingPoints: ["Garder les appuis orientés vers l’avant.", "Varier entre passe courte et passe en profondeur."], equipment: ["Cônes"], fieldSize: "Losange 12×12m", defenderCount: 0, hasGoalkeeper: false },
    main: [
      { title: "Progresser dans trois couloirs", objective: "Avancer sans isoler le porteur.", organization: "Jeu 5 contre 5 dans trois couloirs avec zones d’en-but.", instruction: "Occupe au moins deux couloirs et accompagne chaque passe vers l’avant.", observable: "Trois joueurs participent à chaque progression.", rules: ["Au moins deux couloirs occupés en permanence.", "Une entrée en zone d’en-but vaut un point si accompagnée d’un partenaire."], coachingPoints: ["Accompagner systématiquement le ballon vers l’avant.", "Ne pas laisser le porteur seul en bout de couloir."], equipment: ["Cônes", "Chasubles"], fieldSize: "Trois couloirs 30×6m", defenderCount: 1, hasGoalkeeper: false },
      { title: "Progresser par les rotations", objective: "Créer des lignes de passe en mouvement.", organization: "Jeu réduit dans trois zones avec rotations régulières.", instruction: "Après ta passe, déplace-toi dans une autre ligne.", observable: "Les changements de position ouvrent un passage vers l’avant.", rules: ["Rotation obligatoire après chaque passe vers l’avant.", "Deux touches maximum en zone centrale."], coachingPoints: ["Anticiper la rotation avant de recevoir.", "Utiliser les intervalles créés par les rotations partenaires."], equipment: ["Cônes", "Chasubles"], fieldSize: "Trois zones 12×12m", defenderCount: 1, hasGoalkeeper: false },
    ],
    game: { title: "Match vers les zones d’en-but", objective: "Progresser collectivement jusqu’à la cible.", organization: "Deux équipes et une zone d’en-but à chaque extrémité.", instruction: "Marque en servant un partenaire lancé dans l’en-but.", observable: "Le porteur avance avec du soutien proche et profond.", rules: ["Un but ne compte que si le partenaire reçoit le ballon en mouvement dans l’en-but.", "Cinq secondes maximum pour sortir de sa propre en-but."], coachingPoints: ["Lancer la course avant que le porteur ne soit pressé.", "Garder un joueur en soutien proche à chaque relance."], equipment: ["Chasubles"], fieldSize: "Terrain réduit avec en-buts", defenderCount: 0, hasGoalkeeper: false },
  },
  "Finir les actions": {
    slug: "finir",
    welcome: { title: "Accueil conduite et frappe", objective: "Entrer rapidement dans une intention de finition.", organization: "Deux files face à deux mini-buts, un ballon par joueur.", instruction: "Conduis, lève la tête et vise un coin du but.", observable: "Le joueur regarde la cible avant de frapper.", rules: ["Chaque joueur conduit sur dix mètres avant de frapper.", "Deux essais par file puis rotation."], coachingPoints: ["Relever la tête avant la frappe.", "Frapper du bon pied d’appui, pas en course désordonnée."], equipment: ["Cônes", "Mini-buts"], fieldSize: "Couloir 10×6m", defenderCount: 0, hasGoalkeeper: false },
    activation: { title: "Frappe après remise", objective: "Coordonner remise, course et tir.", organization: "Trios autour de la surface avec un gardien.", instruction: "Remets en une touche puis attaque l’espace pour finir.", observable: "La frappe intervient sans contrôle superflu.", rules: ["La remise doit se faire en une touche.", "Le tireur attaque l’espace libre dès la remise donnée."], coachingPoints: ["Communiquer avant la remise pour synchroniser la course.", "Frapper au premier contact quand c’est possible."], equipment: ["Cônes"], fieldSize: "Devant la surface", defenderCount: 0, hasGoalkeeper: true },
    main: [
      { title: "Finir une attaque à trois", objective: "Choisir entre passe et frappe dans la zone décisive.", organization: "Trois attaquants contre deux défenseurs et un gardien.", instruction: "Attaque vite et termine avant le retour du défenseur.", observable: "Le porteur fixe avant de servir ou de frapper.", rules: ["L’attaque démarre à 25 mètres du but.", "Action limitée à huit secondes avant la frappe."], coachingPoints: ["Fixer le défenseur avant de décider passe ou frappe.", "Varier les prises de balle pour surprendre le gardien."], equipment: ["Chasubles"], fieldSize: "Zone 25×20m", defenderCount: 2, hasGoalkeeper: true },
      { title: "Deux buts pour choisir", objective: "Repérer la cible la plus accessible.", organization: "Jeu 4 contre 4 avec deux mini-buts de chaque côté.", instruction: "Change de cible si la première ligne de frappe se ferme.", observable: "Les joueurs ajustent leur choix à la position des défenseurs.", rules: ["Un but marqué vaut un point, quel que soit le mini-but visé.", "Le changement de cible doit se faire sans perdre le ballon."], coachingPoints: ["Scanner les deux cibles avant de s’engager.", "Ne pas s’enfermer sur la première option venue."], equipment: ["Chasubles", "Mini-buts"], fieldSize: "Terrain 20×15m", defenderCount: 2, hasGoalkeeper: false },
    ],
    game: { title: "Match zones de finition", objective: "Multiplier les tirs préparés en situation réelle.", organization: "Deux équipes avec une zone de finition devant chaque but.", instruction: "Le but compte double après une passe dans la zone de finition.", observable: "Au moins deux joueurs attaquent la surface.", rules: ["Une passe reçue en zone de finition avant le but double sa valeur.", "Hors-jeu simplifié appliqué à l’entrée de la zone."], coachingPoints: ["Faire entrer un deuxième joueur dans la zone au moment du centre.", "Prendre l’espace avant que le gardien ne se replace."], equipment: ["Chasubles"], fieldSize: "Terrain réduit avec zones de finition", defenderCount: 0, hasGoalkeeper: true },
  },
  "Récupérer rapidement": {
    slug: "recuperer",
    welcome: { title: "Accueil chasse au ballon", objective: "Déclencher une réaction immédiate à la perte.", organization: "Groupes de quatre, trois passeurs et un chasseur.", instruction: "Si tu perds le ballon, deviens immédiatement le chasseur.", observable: "Le joueur réagit dans les deux secondes après la perte.", rules: ["Rondo 4 contre 1 dans chaque carré : six passes consécutives = un point pour les extérieurs.", "Le défenseur qui récupère le ballon prend la place du joueur fautif."], coachingPoints: ["Réagir à la perte dans les deux secondes.", "Refermer l’espace le plus proche du ballon."], equipment: ["Cônes"], fieldSize: "2 carrés 10×10m", defenderCount: 1, hasGoalkeeper: false },
    activation: { title: "Duel et contre-pression", objective: "Se rapprocher du ballon dès sa perte.", organization: "Carrés de 12 mètres en deux contre deux avec jokers.", instruction: "À la perte, le joueur le plus proche presse et l’autre ferme une passe.", observable: "Les deux partenaires défendent ensemble.", rules: ["Dès la perte, le joueur le plus proche presse dans la seconde.", "Le partenaire ferme la passe la plus dangereuse plutôt que de doubler le pressing."], coachingPoints: ["Presser à deux, jamais seul.", "Fermer l’angle de passe avant de tenter l’interception."], equipment: ["Cônes", "Chasubles"], fieldSize: "Carrés 12m", defenderCount: 2, hasGoalkeeper: false },
    main: [
      { title: "Récupérer en cinq secondes", objective: "Coordonner pression et couverture après la perte.", organization: "Jeu 5 contre 5 avec deux zones de marque.", instruction: "Après la perte, cinq secondes pour récupérer avant de se replacer.", observable: "Le bloc se resserre autour du ballon.", rules: ["Cinq secondes pour presser collectivement après la perte.", "Passé ce délai, l’équipe se replace en bloc plutôt que de continuer à presser isolément."], coachingPoints: ["Resserrer le bloc dès la perte du ballon.", "Couper les lignes de passe avant de foncer sur le porteur."], equipment: ["Cônes", "Chasubles"], fieldSize: "5 contre 5, 2 zones de marque", defenderCount: 1, hasGoalkeeper: false },
      { title: "Fermer les sorties", objective: "Orienter l’adversaire pour récupérer.", organization: "Jeu 4 contre 4 dans un rectangle avec quatre portes.", instruction: "Le premier défenseur presse, les partenaires ferment les portes proches.", observable: "L’adversaire est orienté vers une zone fermée.", rules: ["Le premier défenseur presse pour orienter le porteur vers une zone fermée.", "Les partenaires ferment uniquement les deux portes les plus proches du ballon."], coachingPoints: ["Orienter le porteur vers la ligne de touche, pas vers le centre.", "Communiquer pour indiquer la porte à fermer en priorité."], equipment: ["Cônes"], fieldSize: "Rectangle 14×10m, 4 portes", defenderCount: 1, hasGoalkeeper: false },
    ],
    game: { title: "Match bonus récupération haute", objective: "Transformer une récupération rapide en occasion.", organization: "Deux équipes sur terrain court avec gardiens.", instruction: "Un but vaut double dans les huit secondes suivant une récupération.", observable: "L’équipe avance ensemble dès que le ballon est récupéré.", rules: ["Un but marqué dans les huit secondes après une récupération haute vaut deux points.", "Le chronomètre de bonus démarre au contact du ballon, pas à l’interception ratée."], coachingPoints: ["Avancer collectivement dès la récupération, ne pas temporiser.", "Chercher la profondeur immédiatement après avoir récupéré le ballon."], equipment: ["Chasubles"], fieldSize: "Terrain court", defenderCount: 1, hasGoalkeeper: true },
  },
};

const blockDurations = [10, 15, 25, 25];
function buildCatalogue(): TrainingActivity[] {
  return Object.entries(themeActivitySets).flatMap(([theme, set]) => {
    const create = (kind: TrainingBlockKind, details: ActivityDetails, suffix = ""): TrainingActivity => ({
      id: `${kind}-${set.slug}${suffix}`,
      kind,
      compatibleThemes: [theme as DevelopmentTheme],
      diagram: buildDiagram(kind, details.defenderCount, details.hasGoalkeeper),
      ...details,
    });
    return [create("welcome", set.welcome), create("activation", set.activation), ...set.main.map((details, index) => create("main", details, `-${index + 1}`)), create("game", set.game)];
  });
}
const catalogue = buildCatalogue();
export const trainingActivityCatalogue: readonly TrainingActivity[] = catalogue;
export function findTrainingActivity(id: string): TrainingActivity | undefined {
  return catalogue.find((activity) => activity.id === id);
}

const cloneActivity = (activity: TrainingActivity): TrainingActivity => ({
  ...activity,
  compatibleThemes: [...activity.compatibleThemes],
  rules: [...activity.rules],
  coachingPoints: [...activity.coachingPoints],
  equipment: [...activity.equipment],
  diagram: {
    ...activity.diagram,
    zones: activity.diagram.zones.map((zone) => ({ ...zone })),
    tokens: activity.diagram.tokens.map((token) => ({ ...token })),
    arrows: activity.diagram.arrows.map((arrow) => ({ ...arrow })),
  },
});

export function generateTrainingSession(week: DevelopmentWeek, ageGroup: AgeGroup, playerCount: number): TrainingSession {
  const id = `session-week-${week.week}-${ageGroup}-${playerCount}`;
  const kinds: TrainingBlockKind[] = ["welcome", "activation", "main", "game"];
  const blocks = kinds.map((kind, index) => {
    const activity = catalogue.find((candidate) => candidate.kind === kind && candidate.compatibleThemes.includes(week.theme));
    if (!activity) throw new Error(`Aucune activité compatible pour le bloc ${kind} et le thème ${week.theme}.`);
    return { id: `${id}-block-${kind}`, activity: cloneActivity(activity), durationMinutes: blockDurations[index] };
  });
  return { id, title: `Séance ${week.week} · ${week.phase}`, ageGroup, playerCount, theme: week.theme, intention: week.intention, blocks };
}

export function getSessionDuration(session: TrainingSession): number { return session.blocks.reduce((total, block) => total + block.durationMinutes, 0); }

export function adjustBlockDuration(session: TrainingSession, index: number, delta: number): TrainingSession {
  const block = session.blocks[index];
  if (!block || !Number.isFinite(delta) || delta === 0 || delta % 5 !== 0) return session;
  const blocks = [...session.blocks];
  blocks[index] = { ...block, durationMinutes: Math.max(5, block.durationMinutes + delta) };
  return { ...session, blocks };
}

export function moveSessionBlock(session: TrainingSession, from: number, to: number): TrainingSession {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= session.blocks.length || to < 0 || to >= session.blocks.length || from === to) return session;
  const blocks = [...session.blocks];
  const [block] = blocks.splice(from, 1);
  blocks.splice(to, 0, block);
  return { ...session, blocks };
}

function replacementCandidates(session: TrainingSession, index: number): TrainingActivity[] {
  const block = session.blocks[index];
  return block ? catalogue.filter((activity) => activity.kind === block.activity.kind && activity.compatibleThemes.includes(session.theme)) : [];
}
export function canReplaceSessionActivity(session: TrainingSession, index: number): boolean {
  const block = session.blocks[index];
  return Boolean(block && replacementCandidates(session, index).some((activity) => activity.id !== block.activity.id));
}
export function replaceSessionActivity(session: TrainingSession, index: number): TrainingSession {
  const block = session.blocks[index];
  if (!block) return session;
  const candidates = replacementCandidates(session, index);
  const currentIndex = candidates.findIndex((activity) => activity.id === block.activity.id);
  if (candidates.length < 2 || currentIndex < 0) return session;
  const blocks = [...session.blocks];
  blocks[index] = { ...block, activity: cloneActivity(candidates[(currentIndex + 1) % candidates.length]) };
  return { ...session, blocks };
}
export function canValidateSession(session: TrainingSession): boolean { const duration = getSessionDuration(session); return duration >= 60 && duration <= 90; }
