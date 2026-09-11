import { describe, expect, it } from "vitest";
import { createConsumeVerificationHandler, createResendVerificationHandler } from "./email-verification";

const educator = { id: "educator-1", email: "coach@example.test", displayName: "Coach" };
const authenticated = async () => educator;
const anonymous = async () => null;

function request(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("createConsumeVerificationHandler", () => {
  it("rejects a request without a token", async () => {
    const handler = createConsumeVerificationHandler({ consume: async () => { throw new Error("not called"); } }, () => undefined);
    expect((await handler(request("POST", "https://evolyfoot.test/api/auth/verify-email", {}))).status).toBe(400);
  });

  it("returns the display name on success", async () => {
    const handler = createConsumeVerificationHandler(
      { consume: async () => ({ displayName: "Coach Test" }) },
      () => undefined,
    );
    const response = await handler(request("POST", "https://evolyfoot.test/api/auth/verify-email", { token: "abc" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", displayName: "Coach Test" });
  });

  it("maps an invalid/expired token to 410", async () => {
    const handler = createConsumeVerificationHandler({ consume: async () => null }, () => undefined);
    const response = await handler(request("POST", "https://evolyfoot.test/api/auth/verify-email", { token: "expired" }));
    expect(response.status).toBe(410);
  });
});

describe("createResendVerificationHandler", () => {
  it("requires an authenticated educator", async () => {
    const handler = createResendVerificationHandler(anonymous, { send: async () => { throw new Error("not called"); } }, () => undefined);
    expect((await handler(request("POST", "https://evolyfoot.test/api/auth/resend-verification"))).status).toBe(401);
  });

  it("sends a new link for the calling educator, from the request origin", async () => {
    const received: Array<{ id: string }> = [];
    const receivedOrigins: string[] = [];
    const handler = createResendVerificationHandler(
      authenticated,
      {
        send: async (input, origin) => {
          received.push(input);
          receivedOrigins.push(origin);
        },
      },
      () => undefined,
    );
    const response = await handler(request("POST", "https://evolyfoot.com/api/auth/resend-verification"));
    expect(response.status).toBe(200);
    expect(received).toEqual([educator]);
    expect(receivedOrigins).toEqual(["https://evolyfoot.com"]);
  });
});
