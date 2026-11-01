import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Nouveau mot de passe — EvolyFoot",
  robots: { index: false },
  // Le jeton est dans l'URL : il ne doit pas fuiter vers un autre site via le Referer.
  referrer: "no-referrer",
};

export default async function ReinitialiserMotDePassePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <main className="onboarding-shell">
      <section className="onboarding-intro">
        <Link className="onboarding-brand" href="/">
          <span className="brand-mark">EV</span> EvolyFoot
        </Link>
        <div>
          <span className="eyebrow light">NOUVEAU MOT DE PASSE</span>
          <h1>Choisis ton nouveau mot de passe.</h1>
          <p>Tes sessions ouvertes seront fermées sur tous tes appareils.</p>
        </div>
      </section>
      <section className="onboarding-panel">
        <ResetPasswordForm token={token} />
      </section>
    </main>
  );
}
