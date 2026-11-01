import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Mot de passe oublié — EvolyFoot", robots: { index: false } };

export default function MotDePasseOubliePage() {
  return (
    <main className="onboarding-shell">
      <section className="onboarding-intro">
        <Link className="onboarding-brand" href="/">
          <span className="brand-mark">E</span> EvolyFoot
        </Link>
        <div>
          <span className="eyebrow light">MOT DE PASSE OUBLIÉ</span>
          <h1>Reprends la main sur ton compte.</h1>
          <p>Tu recevras un lien par e-mail pour choisir un nouveau mot de passe.</p>
        </div>
      </section>
      <section className="onboarding-panel">
        <ForgotPasswordForm />
      </section>
    </main>
  );
}
