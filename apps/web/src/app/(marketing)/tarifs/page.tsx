import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Tarifs — EvolyFoot",
  description:
    "EvolyFoot est gratuit pour préparer la saison d’une équipe U10–U13 : diagnostic, cycle, séances, matchs, présences et fiche joueur. Une offre Premium est à l’étude.",
};

const free = [
  "Diagnostic guidé et cycle de 4 semaines",
  "Constructeur de séance et bibliothèque d’exercices",
  "Calendrier hebdomadaire : séances et matchs",
  "Préparation de match : composition, capitaine, formation",
  "Présences, statistiques et rapport de saison",
  "Fiche joueur avec évaluation datée en toile d’araignée",
  "Accès joueur / tuteur en lecture seule, sur invitation",
];

const premium = [
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
        <h1>Gratuit pour une équipe. Complet, pas bridé.</h1>
        <p>
          Tout ce qu’il faut pour préparer et suivre une saison U10–U13 est disponible sans payer. Une offre Premium
          pour les clubs et les multi-équipes est à l’étude — elle n’enlèvera rien au plan gratuit.
        </p>
      </section>

      <section className="m-section" style={{ paddingTop: 0 }}>
        <div className="m-plans">
          <article className="m-plan m-plan-featured">
            <h3>Gratuit</h3>
            <div className="m-plan-price">
              0 €<small>Pour une équipe, sans limite de durée</small>
            </div>
            <p className="m-plan-desc">L’application complète pour l’éducateur d’une équipe.</p>
            <ul>
              {free.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Link className="m-btn m-btn-primary" href="/inscription">
              Créer mon compte
            </Link>
          </article>

          <article className="m-plan">
            <h3>Premium</h3>
            <div className="m-plan-price">
              À venir<small>Pensé pour les clubs et les multi-équipes</small>
            </div>
            <p className="m-plan-desc">
              Les pistes ci-dessous sont en réflexion. Rien n’est figé : dis-nous ce qui te serait utile.
            </p>
            <ul>
              {premium.map((item) => (
                <li className="m-plan-soon" key={item}>
                  {item}
                </li>
              ))}
            </ul>
            <Link className="m-btn m-btn-ghost" href="/contact">
              Proposer une idée
            </Link>
          </article>
        </div>
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
