import { describe, expect, it } from "vitest";
import { messageMaxLength, validateMessageText } from "./message";

describe("message", () => {
  it("accepte un texte non vide", () => {
    expect(validateMessageText("On sera présents samedi !")).toBeNull();
  });

  it("rejette un texte vide ou uniquement des espaces", () => {
    expect(validateMessageText("")).toMatch(/vide/);
    expect(validateMessageText("   ")).toMatch(/vide/);
  });

  it("rejette un texte trop long", () => {
    expect(validateMessageText("a".repeat(messageMaxLength + 1))).toMatch(new RegExp(String(messageMaxLength)));
  });

  it("accepte un texte pile à la limite", () => {
    expect(validateMessageText("a".repeat(messageMaxLength))).toBeNull();
  });
});
