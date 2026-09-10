import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pour les éducateurs — EvolyFoot",
  description:
    "Diagnostic, cycle de 4 semaines, constructeur de séance, bibliothèque d'exercices, préparation de match, présences et fiche joueur : tout ce qu'EvolyFoot met entre les mains de l'éducateur U10–U13.",
};

const blocks = [
  {
    eyebrow: "Étape 1",
    title: "Le diagnostic guidé",
    text: "Quatre comportements observables — se rendre disponible, voir avant de recevoir, progresser ensemble, réagir après la perte — notés sur une échelle simple, à partir de tes deux ou trois dernières séances. Il n'y a pas de mauvaise réponse : le diagnostic sert à choisir une priorité, pas à juger.",
  },
  {
    eyebrow: "Étape 2",
    title: "Un cycle de 4 semaines construit sur ta priorité",
    text: "EvolyFoot transforme le diagnostic en un plan : semaine 1 pour découvrir le comportement, semaine 2 pour le stabiliser, semaine 3 pour le mettre sous pression, semaine 4 pour évaluer. Chaque semaine a une intention et un repère observable, pas juste un thème.",
  },
  {
    eyebrow: "Étape 3",
    title: "Des séances prêtes, modulables en deux clics",
    text: "Pour chaque créneau du cycle, une séance complète : accueil, activation, situation principale, jeu. Tu ajustes une durée, tu montes ou descends un bloc, tu remplaces une situation par une autre compatible — sans jamais casser l'équilibre de la séance.",
  },
  {
    eyebrow: "Sur le terrain",
    title: "Une bibliothèque d'exercices avec schémas",
    text: "Chaque situation détaille son but, son organisation, sa consigne et ce qu'il faut observer, avec un schéma tactique clair (zones, joueurs, déplacements). De quoi arriver à l'entraînement en sachant exactement quoi installer.",
  },
  {
    eyebrow: "Le week-end",
    title: "La préparation de match",
    text: "Compose ton équipe en touchant directement les postes sur le terrain, désigne un capitaine, choisis une formation adaptée au format de jeu. Après le match, une observation rapide relie ce que tu as vu à l'ajustement de la prochaine séance.",
  },
  {
    eyebrow: "Le suivi",
    title: "Présences, statistiques et fiche joueur",
    text: "La présence se relève à la préparation d'une séance ou d'un match. Les chiffres de la saison s'affichent en diagrammes et en une synthèse. Chaque joueur a sa fiche : coordonnées, photo, et une évaluation en toile d'araignée datée pour suivre sa progression.",
  },
];

export default function EducateursPage() {
  return (
    <main>
      <section className="m-section m-hero">
        <span className="m-eyebrow">Pour les éducateurs</span>
        <h1>Tout le fil de ta semaine, au même endroit.</h1>
        <p>
          EvolyFoot suit l’éducateur du diagnostic à l’ajustement, dans l’ordre où le travail se fait vraiment. Voici
          chaque étape.
        </p>
        <div className="m-hero-actions">
          <Link className="m-btn m-btn-primary" href="/inscription">
            Essayer gratuitement
          </Link>
          <Link className="m-btn m-btn-ghost" href="/methode">
            Comprendre la méthode
          </Link>
        </div>
      </section>

      <section className="m-section m-prose">
        {blocks.map((block) => (
          <article className="m-prose-block" key={block.title}>
            <span className="m-eyebrow">{block.eyebrow}</span>
            <h2>{block.title}</h2>
            <p>{block.text}</p>
          </article>
        ))}
      </section>

      <section className="m-section m-cta-final">
        <h2>Prêt à préparer ta prochaine séance ?</h2>
        <div className="m-hero-actions">
          <Link className="m-btn m-btn-primary" href="/inscription">
            Créer mon compte
          </Link>
          <Link className="m-btn m-btn-ghost" href="/tarifs">
            Voir les tarifs
          </Link>
        </div>
      </section>
    </main>
  );
}
