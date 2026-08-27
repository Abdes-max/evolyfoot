import { describe, expect, it } from "vitest";
import { generateSessionToken, hashSessionToken } from "./session-token";

describe("session tokens", () => {
  it("generates unique, high-entropy tokens", () => {
    const first = generateSessionToken();
    const second = generateSessionToken();

    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(32);
  });

  it("hashes the same token deterministically", () => {
    const token = generateSessionToken();

    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
  });

  it("hashes different tokens to different values", () => {
    const first = generateSessionToken();
    const second = generateSessionToken();

    expect(hashSessionToken(first)).not.toBe(hashSessionToken(second));
  });
});
