import { describe, expect, it } from "vitest";
import { parseTheme, themeInitScript, themeStorageKey } from "./theme";

describe("thème", () => {
  it("ne reconnaît que « light » ; tout le reste vaut sombre", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("autre")).toBe("dark");
    expect(parseTheme(null)).toBe("dark");
  });

  it("lit la même clé de stockage que le bouton", () => {
    expect(themeInitScript).toContain(themeStorageKey);
  });
});
