import type { Metadata } from "next";
import Link from "next/link";
import { PricingToggle } from "./pricing-toggle";

export const metadata: Metadata = {
  title: "Tarifs — EvolyFoot",
  description:
    "EvolyFoot dès 59 € la saison pour un coach et une équipe, moins cher pour les équipes et coachs suivants. 14 jours d’essai gratuit, sans carte bancaire.",
};

export default function TarifsPage() {
  return (
    <main>
      <section className="m-section m-hero">
        <span className="m-eyebrow">Tarifs</span>
        <h1>Un prix simple, moins cher à chaque équipe ajoutée.</h1>
        <p>14 jours d’essai gratuit, sans carte bancaire. Ensuite, le premier coach et sa première équipe paient le tarif Coach ; le reste coûte moins cher.</p>
      </section>

      <section className="m-section" style={{ paddingTop: 0 }}>
        <PricingToggle />
        <p className="m-legal-notice" role="note" style={{ marginTop: 28 }}>
          Le paiement n’est pas encore activé : l’accès reste ouvert pendant la phase de lancement, et ces tarifs s’appliqueront à son activation. Exemple : un
          club de 5 coachs et 6 équipes paie 184 € la saison.
        </p>
      </section>

      <section className="m-section m-cta-final">
        <h2>Commence dès cette semaine.</h2>
        <div className="m-hero-actions">
          <Link className="m-btn m-btn-primary" href="/inscription">
            Essai gratuit de 14 jours
          </Link>
          <Link className="m-btn m-btn-ghost" href="/methode">
            Comprendre la méthode
          </Link>
        </div>
      </section>
    </main>
  );
}
