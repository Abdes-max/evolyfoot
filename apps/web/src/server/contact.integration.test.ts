import { ValidationError } from "@evolyfoot/database";
import { describe, expect, it } from "vitest";
import { createSubmitContactHandler } from "./contact";

function request(body?: unknown): Request {
  return new Request("https://evolyfoot.test/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("contact handler", () => {
  it("rejects a body missing a field with a 400 and never calls the gateway", async () => {
    const handler = createSubmitContactHandler(
      { submit: async () => { throw new Error("not called"); } },
      () => undefined,
    );
    expect((await handler(request({ name: "Alex", email: "a@b.test" }))).status).toBe(400);
  });

  it("forwards a valid submission and returns 201", async () => {
    const received: unknown[] = [];
    const handler = createSubmitContactHandler(
      { submit: async (input) => { received.push(input); } },
      () => undefined,
    );
    const response = await handler(request({ name: "Alex", email: "a@b.test", message: "Bonjour" }));
    expect(response.status).toBe(201);
    expect(received).toEqual([{ name: "Alex", email: "a@b.test", message: "Bonjour" }]);
  });

  it("maps a ValidationError to a 400 with its message", async () => {
    const handler = createSubmitContactHandler(
      { submit: async () => { throw new ValidationError("Indique une adresse e-mail valide."); } },
      () => undefined,
    );
    const response = await handler(request({ name: "Alex", email: "x", message: "Bonjour" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Indique une adresse e-mail valide." });
  });

  it("maps an unexpected error to a 500 and logs it", async () => {
    const logged: unknown[] = [];
    const handler = createSubmitContactHandler(
      { submit: async () => { throw new Error("boom"); } },
      (error) => logged.push(error),
    );
    expect((await handler(request({ name: "Alex", email: "a@b.test", message: "Bonjour" }))).status).toBe(500);
    expect(logged).toHaveLength(1);
  });
});
