import type { DevelopmentWeek } from "./development-plan";
import type { AgeGroup, DevelopmentTheme } from "./index";

export type TrainingBlockKind = "welcome" | "activation" | "main" | "game";
export interface TrainingActivity { id: string; kind: TrainingBlockKind; title: string; compatibleThemes: DevelopmentTheme[]; objective: string; organization: string; instruction: string; observable: string; }
export interface TrainingBlock { id: string; activity: TrainingActivity; durationMinutes: number; }
export interface TrainingSession { id: string; title: string; ageGroup: AgeGroup; playerCount: number; theme: DevelopmentTheme; intention: string; blocks: TrainingBlock[]; }

type ActivityDetails = Omit<TrainingActivity, "id" | "kind" | "compatibleThemes">;
interface ThemeActivitySet { slug: string; welcome: ActivityDetails; activation: ActivityDetails; main: ActivityDetails[]; game: ActivityDetails; }

const themeActivitySets: Record<DevelopmentTheme, ThemeActivitySet> = {
  "Conserver le ballon": {
    slug: "conserver",
    welcome: { title: "Accueil en passes sécurisées", objective: "Installer des repères pour garder le ballon.", organization: "Binômes avec un ballon dans des portes espacées.", instruction: "Contrôle orienté puis passe dans la porte libre.", observable: "Le receveur s’oriente avant le contrôle." },
    activation: { title: "Rondo mobile 4 contre 1", objective: "Offrir des solutions autour du porteur.", organization: "Carrés de 10 mètres, quatre attaquants et un défenseur.", instruction: "Change de côté après ta passe et garde deux solutions visibles.", observable: "Le porteur dispose de deux partenaires démarqués." },
    main: [
      { title: "Conserver en deux zones", objective: "Enchaîner des passes sous pression.", organization: "Deux équipes de quatre et deux jokers dans deux zones.", instruction: "Réalise cinq passes avant de changer de zone.", observable: "L’équipe utilise la largeur et change de zone au bon moment." },
      { title: "Sortir du carré sous pression", objective: "Identifier le moment pour sécuriser ou sortir.", organization: "Jeu 4 contre 2 avec quatre portes extérieures.", instruction: "Après quatre passes, trouve un partenaire lancé dans une porte.", observable: "Les joueurs alternent soutien proche et appel extérieur." },
    ],
    game: { title: "Match bonus conservation", objective: "Réinvestir la conservation en opposition.", organization: "Deux équipes, terrain large, deux mini-buts par camp.", instruction: "Un but compte double après cinq passes consécutives.", observable: "L’équipe ne force pas la progression quand elle est fermée." },
  },
  "Progresser ensemble": {
    slug: "progresser",
    welcome: { title: "Accueil passe et avance", objective: "Associer passe et déplacement vers l’avant.", organization: "Trios en lignes avec un ballon par trio.", instruction: "Passe puis dépasse le partenaire servi.", observable: "Le passeur se remet immédiatement en mouvement." },
    activation: { title: "Appuis en mouvement", objective: "Créer une solution devant et une solution proche.", organization: "Losanges de quatre joueurs avec un ballon.", instruction: "Regarde devant, joue puis change de ligne.", observable: "Le porteur reçoit une solution vers l’avant." },
    main: [
      { title: "Progresser dans trois couloirs", objective: "Avancer sans isoler le porteur.", organization: "Jeu 5 contre 5 dans trois couloirs avec zones d’en-but.", instruction: "Occupe au moins deux couloirs et accompagne chaque passe vers l’avant.", observable: "Trois joueurs participent à chaque progression." },
      { title: "Progresser par les rotations", objective: "Créer des lignes de passe en mouvement.", organization: "Jeu réduit dans trois zones avec rotations régulières.", instruction: "Après ta passe, déplace-toi dans une autre ligne.", observable: "Les changements de position ouvrent un passage vers l’avant." },
    ],
    game: { title: "Match vers les zones d’en-but", objective: "Progresser collectivement jusqu’à la cible.", organization: "Deux équipes et une zone d’en-but à chaque extrémité.", instruction: "Marque en servant un partenaire lancé dans l’en-but.", observable: "Le porteur avance avec du soutien proche et profond." },
  },
  "Finir les actions": {
    slug: "finir",
    welcome: { title: "Accueil conduite et frappe", objective: "Entrer rapidement dans une intention de finition.", organization: "Deux files face à deux mini-buts, un ballon par joueur.", instruction: "Conduis, lève la tête et vise un coin du but.", observable: "Le joueur regarde la cible avant de frapper." },
    activation: { title: "Frappe après remise", objective: "Coordonner remise, course et tir.", organization: "Trios autour de la surface avec un gardien.", instruction: "Remets en une touche puis attaque l’espace pour finir.", observable: "La frappe intervient sans contrôle superflu." },
    main: [
      { title: "Finir une attaque à trois", objective: "Choisir entre passe et frappe dans la zone décisive.", organization: "Trois attaquants contre deux défenseurs et un gardien.", instruction: "Attaque vite et termine avant le retour du défenseur.", observable: "Le porteur fixe avant de servir ou de frapper." },
      { title: "Deux buts pour choisir", objective: "Repérer la cible la plus accessible.", organization: "Jeu 4 contre 4 avec deux mini-buts de chaque côté.", instruction: "Change de cible si la première ligne de frappe se ferme.", observable: "Les joueurs ajustent leur choix à la position des défenseurs." },
    ],
    game: { title: "Match zones de finition", objective: "Multiplier les tirs préparés en situation réelle.", organization: "Deux équipes avec une zone de finition devant chaque but.", instruction: "Le but compte double après une passe dans la zone de finition.", observable: "Au moins deux joueurs attaquent la surface." },
  },
  "Récupérer rapidement": {
    slug: "recuperer",
    welcome: { title: "Accueil chasse au ballon", objective: "Déclencher une réaction immédiate à la perte.", organization: "Groupes de quatre, trois passeurs et un chasseur.", instruction: "Si tu perds le ballon, deviens immédiatement le chasseur.", observable: "Le joueur réagit dans les deux secondes après la perte." },
    activation: { title: "Duel et contre-pression", objective: "Se rapprocher du ballon dès sa perte.", organization: "Carrés de 12 mètres en deux contre deux avec jokers.", instruction: "À la perte, le joueur le plus proche presse et l’autre ferme une passe.", observable: "Les deux partenaires défendent ensemble." },
    main: [
      { title: "Récupérer en cinq secondes", objective: "Coordonner pression et couverture après la perte.", organization: "Jeu 5 contre 5 avec deux zones de marque.", instruction: "Après la perte, cinq secondes pour récupérer avant de se replacer.", observable: "Le bloc se resserre autour du ballon." },
      { title: "Fermer les sorties", objective: "Orienter l’adversaire pour récupérer.", organization: "Jeu 4 contre 4 dans un rectangle avec quatre portes.", instruction: "Le premier défenseur presse, les partenaires ferment les portes proches.", observable: "L’adversaire est orienté vers une zone fermée." },
    ],
    game: { title: "Match bonus récupération haute", objective: "Transformer une récupération rapide en occasion.", organization: "Deux équipes sur terrain court avec gardiens.", instruction: "Un but vaut double dans les huit secondes suivant une récupération.", observable: "L’équipe avance ensemble dès que le ballon est récupéré." },
  },
};

const blockDurations = [10, 15, 25, 25];
function buildCatalogue(): TrainingActivity[] {
  return Object.entries(themeActivitySets).flatMap(([theme, set]) => {
    const create = (kind: TrainingBlockKind, details: ActivityDetails, suffix = ""): TrainingActivity => ({ id: `${kind}-${set.slug}${suffix}`, kind, compatibleThemes: [theme as DevelopmentTheme], ...details });
    return [create("welcome", set.welcome), create("activation", set.activation), ...set.main.map((details, index) => create("main", details, `-${index + 1}`)), create("game", set.game)];
  });
}
const catalogue = buildCatalogue();
const cloneActivity = (activity: TrainingActivity): TrainingActivity => ({ ...activity, compatibleThemes: [...activity.compatibleThemes] });

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
