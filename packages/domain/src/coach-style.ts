import { gameFormats } from "./team";
import { listFormations } from "./match";

// Style de jeu choisi par l'éducateur sur son profil. Le plan reste dicté par le diagnostic : le
// style ajoute une règle au match de fin de séance, sans changer le thème ni les exercices.
export const playStyles = ["Possession", "Pressing", "Jeu vers l’avant", "Équilibré"] as const;
export type PlayStyle = (typeof playStyles)[number];

const playStyleRules: Readonly<Record<PlayStyle, string>> = {
  Possession: "un but compte double après cinq passes consécutives.",
  Pressing: "un but compte double s’il suit une récupération dans le camp adverse.",
  "Jeu vers l’avant": "un but compte double s’il arrive en moins de six secondes après la récupération.",
  Équilibré: "un but compte double si toute l’équipe a franchi la ligne médiane.",
};

export function playStyleNote(style: string | null | undefined): string | null {
  return style && style in playStyleRules
    ? `Ton style « ${style} » : pendant le match de fin de séance, ${playStyleRules[style as PlayStyle]}`
    : null;
}

export const allFormationIds: readonly string[] = [
  ...new Set(gameFormats.flatMap((format) => listFormations(format).map((formation) => formation.id))),
];
