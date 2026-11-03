import type { DevelopmentTheme } from "./index";
import { formationSlots, type LineupRole } from "./match";
import { trainingActivityCatalogue, type TrainingActivity } from "./training-session";
import type { GameFormat } from "./team";

// Lecture d'un match à partir des deux systèmes de jeu : on compare les joueurs ligne par ligne.
// Ce sont des repères pour préparer l'équipe, pas une prédiction du match.
export type LineBalance = "advantage" | "even" | "disadvantage";

export interface MatchupLine {
  readonly id: "midfield" | "attack" | "defense";
  readonly label: string;
  readonly ours: number;
  readonly theirs: number;
  readonly balance: LineBalance;
  readonly advice: string;
}

export interface MatchupAnalysis {
  readonly lines: readonly MatchupLine[];
  readonly summary: string;
  readonly theme: DevelopmentTheme;
  readonly exercises: readonly TrainingActivity[];
}

function countRole(gameFormat: GameFormat, formationId: string, role: LineupRole): number {
  return formationSlots(gameFormat, formationId).filter((slot) => slot.role === role).length;
}

function balanceOf(ours: number, theirs: number): LineBalance {
  return ours > theirs ? "advantage" : ours < theirs ? "disadvantage" : "even";
}

const midfieldAdvice: Readonly<Record<LineBalance, string>> = {
  advantage: "Tu as un joueur libre au milieu : garde le ballon et cherche-le entre les lignes.",
  even: "Duels à égalité au milieu : le joueur qui se démarque le premier fera la différence.",
  disadvantage: "Ils sont plus nombreux au milieu : resserre les lignes et fais redescendre un attaquant à la perte.",
};

const attackAdvice: Readonly<Record<LineBalance, string>> = {
  advantage: "Tes attaquants sont plus nombreux que leurs défenseurs : joue vite vers l’avant.",
  even: "Attaque et défense à égalité : un milieu qui se projette crée le surnombre.",
  disadvantage: "Ton attaque sera en infériorité : fais monter un milieu dès la récupération.",
};

const defenseAdvice: Readonly<Record<LineBalance, string>> = {
  advantage: "Tu as un défenseur de plus que leurs attaquants : sers-t’en pour relancer proprement.",
  even: "Pas de couverture derrière : garde un défenseur en retrait quand tu attaques.",
  disadvantage: "Leur attaque est en surnombre : un milieu redescend et la défense protège sa profondeur.",
};

function themeFor(midfield: LineBalance, attack: LineBalance): DevelopmentTheme {
  if (midfield === "disadvantage") return "Récupérer rapidement";
  if (midfield === "advantage") return "Conserver le ballon";
  return attack === "advantage" ? "Finir les actions" : "Progresser ensemble";
}

const summaries: Readonly<Record<DevelopmentTheme, string>> = {
  "Récupérer rapidement": "Le milieu sera ta zone fragile : prépare l’équipe à réagir vite à la perte.",
  "Conserver le ballon": "Ton surnombre au milieu est ton atout : prépare l’équipe à garder le ballon.",
  "Finir les actions": "Tu auras du monde devant : travaille la finition.",
  "Progresser ensemble": "Les lignes s’équilibrent : la différence se fera par le jeu collectif vers l’avant.",
};

export function analyzeMatchup(gameFormat: GameFormat, ourFormationId: string, opponentFormationId: string): MatchupAnalysis {
  const ours = (role: LineupRole) => countRole(gameFormat, ourFormationId, role);
  const theirs = (role: LineupRole) => countRole(gameFormat, opponentFormationId, role);
  const midfield = balanceOf(ours("midfielder"), theirs("midfielder"));
  const attack = balanceOf(ours("attacker"), theirs("defender"));
  const defense = balanceOf(ours("defender"), theirs("attacker"));
  const theme = themeFor(midfield, attack);

  return {
    lines: [
      {
        id: "midfield",
        label: "Milieu contre milieu",
        ours: ours("midfielder"),
        theirs: theirs("midfielder"),
        balance: midfield,
        advice: midfieldAdvice[midfield],
      },
      {
        id: "attack",
        label: "Ton attaque contre leur défense",
        ours: ours("attacker"),
        theirs: theirs("defender"),
        balance: attack,
        advice: attackAdvice[attack],
      },
      {
        id: "defense",
        label: "Ta défense contre leur attaque",
        ours: ours("defender"),
        theirs: theirs("attacker"),
        balance: defense,
        advice: defenseAdvice[defense],
      },
    ],
    summary: summaries[theme],
    theme,
    exercises: trainingActivityCatalogue.filter((activity) => activity.kind === "main" && activity.compatibleThemes.includes(theme)).slice(0, 3),
  };
}
