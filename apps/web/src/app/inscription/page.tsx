import { trainingActivityCatalogue } from "@evolyfoot/domain";
import Link from "next/link";
import { TacticalDiagramView } from "../tactical-diagram";
import { RegisterForm } from "./register-form";

// Un vrai schéma du catalogue plutôt qu'une photo de stock : ancré dans ce que le produit fait
// réellement (le même composant que /bibliotheque et le constructeur de séance), pas un décor
// générique. "game" pour la densité visuelle (plusieurs joueurs, zones, flèches).
const backdropActivity =
  trainingActivityCatalogue.find((activity) => activity.kind === "game") ?? trainingActivityCatalogue[0];

export default function InscriptionPage() {
  return (
    <main className="onboarding-shell">
      <section className="onboarding-intro">
        <div className="onboarding-intro-backdrop" aria-hidden="true">
          <TacticalDiagramView diagram={backdropActivity.diagram} />
        </div>
        <Link className="onboarding-brand" href="/">
          <span className="brand-mark">E</span> EvolyFoot
        </Link>
        <div className="onboarding-hook">
          <span className="eyebrow light">ESPACE ÉDUCATEUR</span>
          <h1>Ta première séance prête en moins de 10 minutes.</h1>
          <p>Un diagnostic guidé, un plan de progression sur quatre semaines, des séances déjà reliées à tes priorités.</p>
          <ol className="onboarding-loop" aria-label="La boucle EvolyFoot">
            <li>Planifier</li>
            <li>Entraîner</li>
            <li>Observer</li>
            <li>Ajuster</li>
          </ol>
        </div>
      </section>
      <section className="onboarding-panel">
        <RegisterForm />
      </section>
    </main>
  );
}
