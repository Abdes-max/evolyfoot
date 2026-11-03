import { describe, expect, it } from "vitest";
import { convocationFeedback } from "./convocation";

describe("convocationFeedback", () => {
  it("annonce les joueurs convoqués, puis les rappels par e-mail s'il y en a", () => {
    expect(convocationFeedback(1)).toBe("Convocation envoyée à 1 joueur.");
    expect(convocationFeedback(14, 0)).toBe("Convocation envoyée à 14 joueurs.");
    expect(convocationFeedback(14, 3)).toBe("Convocation envoyée à 14 joueurs. Rappel envoyé par e-mail à 3 adresses.");
  });
});
