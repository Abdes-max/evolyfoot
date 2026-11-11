// Palette sombre (thème d'origine) et palette claire. `colors` lit toujours la palette du thème courant : un composant
// qui lit `colors.x` pendant son rendu suit donc le thème. Changer de thème (`setTheme`) ne met rien à jour tout seul :
// l'appli remonte son arbre de composants juste après (voir lib/theme.tsx de chaque appli).
export const darkColors = {
  ink: "#f4f6f9",
  muted: "#8b96a8",
  paper: "#070b12",
  surface: "#101722",
  line: "#232c3c",
  primary: "#2fd4ff",
  primaryDark: "#123349",
  primarySoft: "#0f2233",
  primaryInk: "#062330",
  warn: "#ffb073",
  warnSoft: "#3a2416",
  danger: "#ff8fa3",
  dangerSoft: "#3a1a20",
  lime: "#c6ff3d",
  orange: "#ffb073",
  blue: "#7c9cff",
} as const;

export type Palette = { readonly [Key in keyof typeof darkColors]: string };

export const lightColors: Palette = {
  ink: "#0f1b2a",
  muted: "#566277",
  paper: "#f3f6fa",
  surface: "#ffffff",
  line: "#d6dee9",
  primary: "#0b86b8",
  primaryDark: "#9fd3ea",
  primarySoft: "#e3f3fa",
  primaryInk: "#ffffff",
  warn: "#b45309",
  warnSoft: "#fff0dd",
  danger: "#c0392b",
  dangerSoft: "#fbe4e0",
  lime: "#4d7c0f",
  orange: "#b45309",
  blue: "#3556d6",
};

export type ThemeName = "dark" | "light";

let currentTheme: ThemeName = "dark";

export function setTheme(theme: ThemeName): void {
  currentTheme = theme;
}

export function getTheme(): ThemeName {
  return currentTheme;
}

export function parseTheme(value: string | null | undefined): ThemeName {
  return value === "light" ? "light" : "dark";
}

export const colors: Palette = new Proxy(darkColors as Palette, {
  get: (_target, key) => (currentTheme === "light" ? lightColors : darkColors)[key as keyof Palette],
});

export const radii = { sm: 10, md: 18, lg: 28, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
