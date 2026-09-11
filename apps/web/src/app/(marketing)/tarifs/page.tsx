import type { Metadata } from "next";
import Link from "next/link";
import { PricingToggle } from "./pricing-toggle";

export const metadata: Metadata = {
  title: "Tarifs — EvolyFoot",
  description:
    "EvolyFoot est gratuit pour planifier et suivre une équipe U10–U13. Premium ajoute le constructeur de séance, l’évaluation joueur et les outils multi-équipes.",
};

const free = [
  "Diagnostic guidé et cycle de 4 semaines",
  "Bibliothèque d’exercices, en consultation",
  "Calendrier hebdomadaire : séances et matchs",
  "Préparation de match : composition, capitaine, formation",
  "Présences et rapport de saison",
  "Accès joueur / tuteur en lecture seule, sur invitation",
];

const premium = [
  "Constructeur de séance personnalisée",
  "Évaluation joueur datée en toile d’araignée",
  "Plusieurs équipes sur un même compte",
  "Partage entre éducateurs d’un même club",
  "Export des séances et des bilans en PDF",
  "Historique de progression sur plusieurs saisons",
];

export default function TarifsPage() {
  return (
    <main>
      <section className="m-section m-hero">
        <span className="m-eyebrow">Tarifs</span>
        <h1>Gratuit pour planifier. Premium pour créer et suivre en détail.</h1>
        <p>
          Le plan gratuit couvre le diagnostic, le cycle, le calendrier et les matchs d’une équipe. Premium ajoute le
          constructeur de séance et l’évaluation joueur, avec trois façons de payer.
        </p>
      </section>

      <section className="m-section" style={{ paddingTop: 0 }}>
        <div className="m-plans">
          <article className="m-plan">
            <h3>Gratuit</h3>
            <div className="m-plan-price">
              0 €<small>Pour une équipe, sans limite de durée</small>
            </div>
            <p className="m-plan-desc">Pour planifier la saison et suivre les présences et les matchs.</p>
            <ul>
              {free.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Link className="m-btn m-btn-ghost" href="/inscription">
              Créer mon compte
            </Link>
          </article>

          <article className="m-plan m-plan-featured">
            <h3>Premium</h3>
            <PricingToggle />
            <p className="m-plan-desc">Pour construire tes propres séances et suivre la progression de chaque joueur.</p>
            <ul>
              {premium.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Link className="m-btn m-btn-primary" href="/contact">
              Être prévenu au lancement
            </Link>
          </article>
        </div>
        <p className="m-legal-notice" role="note" style={{ marginTop: 28 }}>
          Premium est en préparation : les tarifs ci-dessus sont une proposition, aucun paiement n’est activé
          aujourd’hui. Le plan Gratuit reste disponible sans condition de durée.
        </p>
      </section>

      <section className="m-section m-cta-final">
        <h2>Commence dès cette semaine.</h2>
        <div className="m-hero-actions">
          <Link className="m-btn m-btn-primary" href="/inscription">
            Essayer gratuitement
          </Link>
          <Link className="m-btn m-btn-ghost" href="/methode">
            Comprendre la méthode
          </Link>
        </div>
      </section>
    </main>
  );
}
