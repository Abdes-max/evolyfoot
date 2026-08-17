import { describe, expect, it } from "vitest";
import { demoFocus } from "./index";
import { suggestAdjustment } from "./progression";

describe("suggestAdjustment", () => {
  it("augmente la pression quand la réaction à la perte est fragile", () => {
    const result = suggestAdjustment(demoFocus, {
      availability: 78,
      scanning: 61,
      reactionAfterLoss: 46,
    });

    expect(result.action).toBe("increase-pressure");
    expect(result.reason).toContain("46/100");
  });

  it("consolide un thème maîtrisé avant de passer au suivant", () => {
    const result = suggestAdjustment(
      { ...demoFocus, progress: 82 },
      { availability: 76, scanning: 73, reactionAfterLoss: 68 },
    );

    expect(result.action).toBe("consolidate");
  });
});
