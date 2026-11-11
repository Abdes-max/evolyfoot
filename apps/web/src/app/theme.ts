// Thème de l'interface : sombre par défaut, clair au choix (bouton à bascule). Le choix reste dans le navigateur.
export const themeStorageKey = "evolyfoot-theme";
export const themeChangeEvent = "evolyfoot-theme";

export type Theme = "dark" | "light";

export function parseTheme(value: string | null | undefined): Theme {
  return value === "light" ? "light" : "dark";
}

// Posé dans <head> avant l'affichage : évite un éclair de thème sombre quand le visiteur a choisi le clair.
export const themeInitScript = `try{var t=localStorage.getItem("${themeStorageKey}");document.documentElement.dataset.theme=t==="light"?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}`;
