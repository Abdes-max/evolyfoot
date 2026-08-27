import Link from "next/link";
import { LoginForm } from "./login-form";

export default function ConnexionPage() {
  return (
    <main className="onboarding-shell">
      <section className="onboarding-intro">
        <Link className="onboarding-brand" href="/">
          <span className="brand-mark">E</span> EvolyFoot
        </Link>
        <div>
          <span className="eyebrow light">ESPACE ÉDUCATEUR</span>
          <h1>Retrouve ton équipe.</h1>
          <p>Connecte-toi pour accéder à ton plan de progression, tes séances et tes observations.</p>
        </div>
      </section>
      <section className="onboarding-panel">
        <LoginForm />
      </section>
    </main>
  );
}
