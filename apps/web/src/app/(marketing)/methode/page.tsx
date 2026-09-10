import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "La méthode EvolyFoot — EvolyFoot",
  description:
    "Pourquoi un cycle de 4 semaines, pourquoi une priorité à la fois, et pourquoi chaque ajustement est expliqué plutôt qu'imposé. La logique pédagogique derrière EvolyFoot.",
};

const principles = [
  {
    title: "Une priorité à la fois",
    text: "Une équipe de jeunes ne progresse pas sur dix axes en même temps. Le diagnostic fait ressortir le comportement le plus fragile ; c'est lui qu'on travaille, avec un second en soutien. Le reste attend le cycle suivant.",
  },
  {
    title: "Quatre semaines, quatre intentions",
    text: "Découvrir le comportement, le stabiliser dans des situations variées, le mettre sous pression quand le temps et l'espace se réduisent, puis l'évaluer en jeu libre. Chaque semaine a un repère observable : on sait si on avance.",
  },
  {
    title: "La séance sert l'intention, pas l'inverse",
    text: "Les situations proposées pour une semaine visent son intention. Quand tu ajustes une durée ou remplaces un exercice, EvolyFoot ne te laisse choisir que des options qui gardent la séance cohérente.",
  },
  {
    title: "L'ajustement est expliqué, jamais imposé",
    text: "Après une séance ou un match, EvolyFoot propose un ajustement pour la fois suivante — et te dit sur quoi il se fonde (ce que tu as observé, le repère de la semaine). Tu peux l'accepter, le modifier ou le refuser. C'est un avis, pas une boîte noire.",
  },
  {
    title: "Le suivi appartient à l'éducateur",
    text: "Ton effectif, tes séances, tes observations et tes évaluations sont à toi. Ils servent à voir la progression sur une saison, pas à alimenter un classement.",
  },
];

export default function MethodePage() {
  return (
    <main>
      <section className="m-section m-hero">
        <span className="m-eyebrow">La méthode</span>
        <h1>Une boucle claire, que tu suis à ton rythme.</h1>
        <p>
          EvolyFoot n’invente pas une pédagogie : il met en forme celle que les éducateurs de jeunes appliquent déjà, et
          la rend tenable semaine après semaine.
        </p>
      </section>

      <section className="m-section">
        <h2>La boucle</h2>
        <div className="m-loop">
          <div className="m-loop-step">
            <span aria-hidden="true">1</span>
            <h3>Diagnostic</h3>
            <p>Quatre comportements notés à partir des dernières séances. Deux priorités en ressortent.</p>
          </div>
          <div className="m-loop-step">
            <span aria-hidden="true">2</span>
            <h3>Plan 4 semaines</h3>
            <p>Découvrir, stabiliser, mettre sous pression, évaluer — sur ta priorité.</p>
          </div>
          <div className="m-loop-step">
            <span aria-hidden="true">3</span>
            <h3>Séance</h3>
            <p>Une séance prête par créneau, ajustable sans casser son équilibre.</p>
          </div>
          <div className="m-loop-step">
            <span aria-hidden="true">4</span>
            <h3>Observation &amp; ajustement</h3>
            <p>Ce que tu as vu devient un ajustement expliqué pour la fois suivante.</p>
          </div>
        </div>
      </section>

      <section className="m-section m-prose">
        {principles.map((principle) => (
          <article className="m-prose-block" key={principle.title}>
            <h2>{principle.title}</h2>
            <p>{principle.text}</p>
          </article>
        ))}
      </section>

      <section className="m-section m-cta-final">
        <h2>Essayer la boucle sur ton équipe</h2>
        <div className="m-hero-actions">
          <Link className="m-btn m-btn-primary" href="/inscription">
            Commencer le diagnostic
          </Link>
          <Link className="m-btn m-btn-ghost" href="/educateurs">
            Voir les fonctionnalités
          </Link>
        </div>
      </section>
    </main>
  );
}
