import Link from "next/link";
import { RegisterForm } from "./register-form";

export default function InscriptionPage() {
  return (
    <main className="onboarding-shell">
      <section className="onboarding-intro">
        <Link className="onboarding-brand" href="/">
          <span className="brand-mark">E</span> EvolyFoot
        </Link>
        <div>
          <span className="eyebrow light">ESPACE ÉDUCATEUR</span>
          <h1>Commençons par ton compte.</h1>
          <p>Crée ton compte éducateur pour sauvegarder ton équipe et suivre sa progression.</p>
        </div>
      </section>
      <section className="onboarding-panel">
        <RegisterForm />
      </section>
    </main>
  );
}
