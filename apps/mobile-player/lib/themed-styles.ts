import { getTheme } from "@evolyfoot/design-tokens";

// Feuille de styles qui suit le thème : `factory` (un `StyleSheet.create` qui lit `colors`) est rejouée une fois par thème, à la
// première lecture, puis gardée. `styles.x` s'utilise comme avant ; après un changement de thème, les composants remontés
// relisent la feuille du nouveau thème.
export function themedStyles<Sheet extends object>(factory: () => Sheet): Sheet {
  const sheets = new Map<string, Sheet>();
  const current = (): Sheet => {
    const theme = getTheme();
    let sheet = sheets.get(theme);
    if (!sheet) {
      sheet = factory();
      sheets.set(theme, sheet);
    }
    return sheet;
  };
  return new Proxy({} as Sheet, {
    get: (_target, key) => (current() as Record<string | symbol, unknown>)[key],
    has: (_target, key) => key in current(),
    ownKeys: () => Reflect.ownKeys(current()),
    getOwnPropertyDescriptor: (_target, key) => (key in current() ? { enumerable: true, configurable: true } : undefined),
  });
}
