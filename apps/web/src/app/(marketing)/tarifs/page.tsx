import type { Metadata } from "next";
import Link from "next/link";
import { PricingToggle } from "./pricing-toggle";

export const metadata: Metadata = {
  title: "Tarifs — EvolyFoot",
  description: "EvolyFoot est gratuit pour une équipe U10–U13, constructeur de séance et évaluation joueur compris. Premium est en préparation.",
};

const free = [
  "Diagnostic guidé et cycle de 4 semaines",
  "Bibliothèque d’exercices et constructeur de séance",
  "Évaluation joueur datée en toile d’araignée",
  "Calendrier hebdomadaire : séances et matchs",
  "Préparation de match : composition, capitaine, formation",
  "Présences et rapport de saison",
  "Accès joueur / tuteur en lecture seule, sur invitation",
  "Adjoints invités sur l’équipe",
  "Progression de chaque joueur d’une saison à l’autre",
];

// Rien de cette liste n'existe encore dans l'app : ne rien y ajouter avant que ce soit livré sans
// la marquer "à venir" dans la page.
const premium = ["Plusieurs équipes sur un même compte", "Partage entre éducateurs d’un même club"];

export default function TarifsPage() {
  return (
    <main>
      <section className="m-section m-hero">
        <span className="m-eyebrow">Tarifs</span>
        <h1>Tout ce qui existe aujourd’hui est gratuit.</h1>
        <p>
          Le plan gratuit couvre toutes les fonctionnalités disponibles pour une équipe. Premium ajoutera des outils pour aller plus loin : ils sont en
          préparation et signalés comme tels ci-dessous.
        </p>
      </section>

      <section className="m-section" style={{ paddingTop: 0 }}>
        <div className="m-plans">
          <article className="m-plan">
            <h3>Gratuit</h3>
            <div className="m-plan-price">
              0 €<small>Pour une équipe, sans limite de durée</small>
            </div>
            <p className="m-plan-desc">Pour préparer la saison, créer ses séances et suivre chaque joueur.</p>
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
            <h3>Premium · à venir</h3>
            <PricingToggle />
            <p className="m-plan-desc">Fonctionnalités à venir, pas encore disponibles dans l’application.</p>
            <ul>
              {premium.map((item) => (
                <li key={item}>{item} (à venir)</li>
              ))}
            </ul>
            <Link className="m-btn m-btn-primary" href="/contact">
              Être prévenu au lancement
            </Link>
          </article>
        </div>
        <p className="m-legal-notice" role="note" style={{ marginTop: 28 }}>
          Premium est en préparation : les tarifs ci-dessus sont une proposition, aucun paiement n’est activé aujourd’hui. Le plan Gratuit reste disponible sans
          condition de durée.
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
