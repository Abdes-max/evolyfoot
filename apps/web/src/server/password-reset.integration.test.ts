import { PasswordResetInvalidError, ValidationError } from "@evolyfoot/database";
import { describe, expect, it, vi } from "vitest";
import { renderPasswordResetEmail, renderVerificationEmail } from "./mailer";
import { createForgotPasswordHandler, createResetPasswordHandler } from "./password-reset";

function post(body: unknown): Request {
  return new Request("http://localhost/api/auth", { method: "POST", body: JSON.stringify(body) });
}

describe("createForgotPasswordHandler", () => {
  it("répond pareil que l'envoi réussisse ou échoue", async () => {
    const ok = createForgotPasswordHandler({ request: async () => undefined }, vi.fn());
    const failing = createForgotPasswordHandler(
      {
        request: async () => {
          throw new Error("panne");
        },
      },
      vi.fn(),
    );

    const first = await ok(post({ email: "a@example.test" }));
    const second = await failing(post({ email: "b@example.test" }));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await first.json()).toEqual(await second.json());
  });

  it("exige une adresse", async () => {
    const request = vi.fn();

    expect((await createForgotPasswordHandler({ request }, vi.fn())(post({}))).status).toBe(400);
    expect(request).not.toHaveBeenCalled();
  });
});

describe("createResetPasswordHandler", () => {
  it("applique un lien valide", async () => {
    const reset = vi.fn(async () => undefined);

    const response = await createResetPasswordHandler({ reset }, vi.fn())(post({ token: "t", password: "nouveau-mot-de-passe" }));

    expect(response.status).toBe(200);
    expect(reset).toHaveBeenCalledWith("t", "nouveau-mot-de-passe");
  });

  it("traduit lien périmé et mot de passe refusé", async () => {
    const expired = createResetPasswordHandler(
      {
        reset: async () => {
          throw new PasswordResetInvalidError();
        },
      },
      vi.fn(),
    );
    const refused = createResetPasswordHandler(
      {
        reset: async () => {
          throw new ValidationError("Trop court.");
        },
      },
      vi.fn(),
    );

    expect((await expired(post({ token: "t", password: "x" }))).status).toBe(410);
    expect((await refused(post({ token: "t", password: "x" }))).status).toBe(400);
  });
});

describe("gabarits d'e-mail", () => {
  it("contiennent le lien et échappent le nom affiché", () => {
    const reset = renderPasswordResetEmail("<b>Coach</b>", "https://evolyfoot.com/reinitialiser-mot-de-passe/abc");
    const verification = renderVerificationEmail("<b>Coach</b>", "https://evolyfoot.com/verifier-email/abc");

    expect(reset.html).toContain("https://evolyfoot.com/reinitialiser-mot-de-passe/abc");
    expect(reset.text).toContain("1 heure");
    expect(reset.html).not.toContain("<b>Coach</b>");
    expect(verification.html).not.toContain("<b>Coach</b>");
    expect(verification.html).toContain("&lt;b&gt;Coach&lt;/b&gt;");
  });
});
