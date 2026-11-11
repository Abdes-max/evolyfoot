"use client";

import { useSyncExternalStore } from "react";
import { parseTheme, themeChangeEvent, themeStorageKey, type Theme } from "./theme";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(themeChangeEvent, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(themeChangeEvent, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readTheme(): Theme {
  try {
    return parseTheme(window.localStorage.getItem(themeStorageKey));
  } catch {
    return "dark";
  }
}

function applyTheme(theme: Theme) {
  try {
    window.localStorage.setItem(themeStorageKey, theme);
  } catch {
    // Sans stockage, le choix ne vaut que pour cette page.
  }
  document.documentElement.dataset.theme = theme;
  window.dispatchEvent(new Event(themeChangeEvent));
}

// Bouton à bascule sombre / clair : pastille qui glisse, lune à gauche, soleil à droite.
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "dark" as Theme);
  const light = theme === "light";
  return (
    <button
      aria-checked={light}
      aria-label={light ? "Passer au thème sombre" : "Passer au thème clair"}
      className="theme-toggle"
      onClick={() => applyTheme(light ? "dark" : "light")}
      role="switch"
      type="button"
    >
      <span aria-hidden="true" className="theme-toggle-knob">
        {light ? (
          <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24" width="14">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        ) : (
          <svg fill="currentColor" height="14" viewBox="0 0 24 24" width="14">
            <path d="M21 14.5A9 9 0 0 1 9.5 3a9 9 0 1 0 11.5 11.5Z" />
          </svg>
        )}
      </span>
    </button>
  );
}
