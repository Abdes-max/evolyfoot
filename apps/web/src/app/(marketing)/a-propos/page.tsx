import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "À propos — EvolyFoot",
  description:
    "Pourquoi EvolyFoot existe : aider l’éducateur de foot U10–U13 à préparer des séances qui font progresser, sans y passer ses soirées.",
};

const blocks = [
  {
    eyebrow: "Le constat",
    title: "L’éducateur bénévole n’a pas le temps qu’on lui demande",
    text: "Dans la plupart des clubs, la séance du mardi se prépare le mardi après-midi, entre le travail et le terrain. On récupère des exercices ici et là, on improvise, et on se demande après coup si les enfants ont vraiment progressé. Ce n’est pas un problème de motivation : c’est un problème d’outils.",
  },
  {
    eyebrow: "Le parti pris",
    title: "Une méthode, pas un catalogue",
    text: "EvolyFoot ne cherche pas à empiler des centaines d’exercices. Il suit un fil : un diagnostic pour choisir une priorité, un cycle de 4 semaines pour la travailler, des séances prêtes à ajuster, un match pour l’éprouver, une observation pour relier le week-end à la séance suivante. Chaque écran répond à une question que l’éducateur se pose déjà.",
  },
  {
    eyebrow: "Pour qui",
    title: "U10 à U13, football à effectif réduit",
    text: "Les contenus sont pensés pour les catégories où l’on joue à 5, 8 ou 9, où l’enjeu est le développement individuel dans le jeu et non le résultat. Les comportements observés — se rendre disponible, voir avant de recevoir, jouer ensemble, réagir après la perte — sont ceux de cette tranche d’âge.",
  },
  {
    eyebrow: "L’état du projet",
    title: "Jeune, en construction, à l’écoute",
    text: "EvolyFoot est développé par une petite équipe et enrichi au fil des retours d’éducateurs sur le terrain. Certaines briques sont solides, d’autres arrivent. Nous préférons l’annoncer clairement plutôt que gonfler la vitrine : si une fonctionnalité manque ou coince, écris-nous, ça oriente vraiment la suite.",
  },
];

export default function AProposPage() {
  return (
    <main>
      <section className="m-section m-hero">
        <span className="m-eyebrow">À propos</span>
        <h1>Prépare des séances qui font progresser, sans y passer tes soirées.</h1>
        <p>
          EvolyFoot est né sur les bords de terrain U10–U13, du besoin d’un fil clair entre ce qu’on observe et ce qu’on
          fait travailler la semaine suivante.
        </p>
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
        <h2>Une question, une idée, un retour ?</h2>
        <div className="m-hero-actions">
          <Link className="m-btn m-btn-primary" href="/contact">
            Nous écrire
          </Link>
          <Link className="m-btn m-btn-ghost" href="/inscription">
            Essayer gratuitement
          </Link>
        </div>
      </section>
    </main>
  );
}
