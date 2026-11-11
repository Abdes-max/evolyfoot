import { getTheme, parseTheme, setTheme, type ThemeName } from "@evolyfoot/design-tokens";
import * as SecureStore from "expo-secure-store";
import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const THEME_KEY = "evolyfoot.theme";

interface ThemeContextValue {
  theme: ThemeName;
  toggleTheme(): void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: "dark", toggleTheme: () => undefined });

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

// Thème sombre par défaut, clair au choix (bouton à bascule). Le choix est gardé sur le téléphone. Les feuilles de styles et
// `colors` se lisent au rendu : après un changement, l'arbre est remonté (`key`) pour que tout relise la nouvelle palette.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    SecureStore.getItemAsync(THEME_KEY)
      .catch(() => null)
      .then((stored) => {
        if (cancelled) return;
        setTheme(parseTheme(stored));
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleTheme = useCallback(() => {
    const next: ThemeName = getTheme() === "light" ? "dark" : "light";
    setTheme(next);
    SecureStore.setItemAsync(THEME_KEY, next).catch(() => undefined);
    setVersion((value) => value + 1);
  }, []);

  // Une valeur neuve à chaque version : les composants qui lisent `useTheme` se mettent à jour.
  const value = useMemo(() => ({ theme: getTheme(), toggleTheme }), [toggleTheme, version]);

  if (!ready) return null;
  return (
    <ThemeContext.Provider value={value}>
      <Fragment key={version}>{children}</Fragment>
    </ThemeContext.Provider>
  );
}
