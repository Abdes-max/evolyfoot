import type { DevelopmentWeek } from "./development-plan";
import type { AgeGroup, DevelopmentTheme } from "./index";

export type TrainingBlockKind = "welcome" | "activation" | "main" | "game";

export interface TrainingActivity {
  id: string;
  kind: TrainingBlockKind;
  title: string;
  compatibleThemes: DevelopmentTheme[];
  objective: string;
  organization: string;
  instruction: string;
  observable: string;
}

export interface TrainingBlock {
  activity: TrainingActivity;
  durationMinutes: number;
}

export interface TrainingSession {
  id: string;
  title: string;
  ageGroup: AgeGroup;
  playerCount: number;
  theme: DevelopmentTheme;
  intention: string;
  blocks: TrainingBlock[];
}

const themes: DevelopmentTheme[] = [
  "Conserver le ballon",
  "Progresser ensemble",
  "Finir les actions",
  "Récupérer rapidement",
];

const catalogue: TrainingActivity[] = [
  {
    id: "welcome-circle-and-ball",
    kind: "welcome",
    title: "Accueil, jeu des prénoms et ballon",
    compatibleThemes: themes,
    objective: "Entrer dans la séance avec attention et plaisir.",
    organization: "Groupe réuni dans un espace délimité, un ballon pour deux.",
    instruction: "Présente l’intention de la séance puis fais circuler le ballon.",
    observable: "Les joueurs sont disponibles et identifient l’intention du jour.",
  },
  {
    id: "activation-passes-and-movement",
    kind: "activation",
    title: "Passer et bouger",
    compatibleThemes: themes,
    objective: "Coordonner les déplacements et la prise d’information.",
    organization: "Carré de 15 mètres, joueurs répartis sur les côtés.",
    instruction: "Après chaque passe, change de place et propose une solution.",
    observable: "Le porteur reçoit au moins une solution avant de jouer.",
  },
  {
    id: "main-three-lanes",
    kind: "main",
    title: "Créer des solutions dans trois zones",
    compatibleThemes: themes,
    objective: "Faire progresser le ballon grâce à des relations proches.",
    organization: "Jeu à effectif réduit dans trois zones avec deux buts cibles.",
    instruction: "Cherche une solution proche, une solution côté faible ou une progression.",
    observable: "Les joueurs se rendent disponibles autour du porteur.",
  },
  {
    id: "game-free-play",
    kind: "game",
    title: "Jeu libre à thème",
    compatibleThemes: themes,
    objective: "Réinvestir l’intention dans un jeu proche du match.",
    organization: "Deux équipes, terrain adapté à l’effectif et rotations courtes.",
    instruction: "Laisse jouer et relance uniquement avec des questions liées au thème.",
    observable: "Le comportement recherché apparaît spontanément en jeu.",
  },
];

const blockKinds: TrainingBlockKind[] = ["welcome", "activation", "main", "game"];
const blockDurations = [10, 15, 25, 25];

export function generateTrainingSession(
  week: DevelopmentWeek,
  ageGroup: AgeGroup,
  playerCount: number,
): TrainingSession {
  const blocks = blockKinds.map((kind, index) => {
    const activity = catalogue.find(
      (candidate) => candidate.kind === kind && candidate.compatibleThemes.includes(week.theme),
    );

    if (!activity) {
      throw new Error(`Aucune activité compatible pour le bloc ${kind} et le thème ${week.theme}.`);
    }

    return { activity, durationMinutes: blockDurations[index] };
  });

  return {
    id: `session-week-${week.week}-${ageGroup}-${playerCount}`,
    title: `Séance ${week.week} · ${week.phase}`,
    ageGroup,
    playerCount,
    theme: week.theme,
    intention: week.intention,
    blocks,
  };
}

export function getSessionDuration(session: TrainingSession): number {
  return session.blocks.reduce((total, block) => total + block.durationMinutes, 0);
}
