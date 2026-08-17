import { describe, expect, it } from "vitest";
import { summarizeDiagnostic } from "./diagnostic";
describe("initial diagnostic", () => {
  it("retient les deux comportements les plus fragiles", () => { const result = summarizeDiagnostic({ availability: 3, scanning: 2, progression: 4, reactionAfterLoss: 1 }); expect(result.average).toBe(2.5); expect(result.priorities.map((item) => item.criterion)).toEqual(["reactionAfterLoss", "scanning"]); });
  it("refuse une note hors échelle", () => expect(() => summarizeDiagnostic({ availability: 0, scanning: 2, progression: 3, reactionAfterLoss: 4 })).toThrow(/1 à 4/));
});
