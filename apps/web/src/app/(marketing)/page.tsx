import Link from "next/link";
import { AuthedRedirect } from "./authed-redirect";

const loop = [
  { n: "1", title: "Diagnostic", text: "Quatre comportements observables, notés au ressenti. Deux priorités en ressortent." },
  { n: "2", title: "Plan 4 semaines", text: "Découvrir, stabiliser, mettre sous pression, évaluer — un cycle construit sur tes priorités." },
  { n: "3", title: "Séance modulable", text: "Une séance prête pour chaque créneau, ajustable en deux clics avant l’entraînement." },
  { n: "4", title: "Observation & ajustement", text: "Après la séance ou le match, un ajustement expliqué — jamais une boîte noire." },
];

const features = [
  { title: "Bibliothèque d’exercices", text: "Des situations avec schéma tactique, but du jeu, consignes et points de coaching." },
  { title: "Préparation de match", text: "Compose ton équipe en touchant le terrain, désigne un capitaine, plusieurs formations par format." },
  { title: "Présences & statistiques", text: "La présence se relève à la préparation ; les chiffres de la saison en diagrammes et en rapport." },
  { title: "Fiche joueur", text: "Coordonnées, photo, et une évaluation en toile d’araignée datée pour suivre la progression." },
  { title: "Calendrier de la semaine", text: "Séances et matchs de la semaine d’un coup d’œil, cliquables depuis le tableau de bord." },
  { title: "Web et mobile", text: "La même équipe, le même plan, synchronisés entre l’ordinateur et le téléphone." },
];

const faq = [
  { q: "Pour quelle catégorie ?", a: "EvolyFoot est pensé pour le football de jeunes, en particulier les catégories U10 à U13." },
  { q: "Faut-il être diplômé ?", a: "Non. EvolyFoot s’adresse aussi bien aux éducateurs diplômés qu’aux bénévoles qui débutent." },
  { q: "Mes données sont-elles à moi ?", a: "Oui. Ton effectif, tes séances et tes observations t’appartiennent et restent privés." },
  { q: "Web ou mobile ?", a: "Les deux. L’application web pour préparer, l’application mobile pour le bord du terrain." },
  { q: "Combien de temps pour démarrer ?", a: "Le diagnostic et le premier cycle se font en quelques minutes, avant ta prochaine séance." },
  { q: "C’est vraiment gratuit ?", a: "Le plan gratuit couvre le diagnostic, le plan, une équipe et des séances illimitées." },
];

export default function MarketingHome() {
  return (
    <main>
      <AuthedRedirect to="/app" />

      <section className="m-section m-hero">
        <span className="m-eyebrow">Éducateurs U10–U13</span>
        <h1>Prépare des séances qui font progresser, sans y passer tes soirées.</h1>
        <p>
          EvolyFoot transforme ton diagnostic d’équipe en un cycle de 4 semaines, des séances prêtes à l’emploi et des
          ajustements expliqués après chaque match.
        </p>
        <div className="m-hero-actions">
          <Link className="m-btn m-btn-primary" href="/inscription">
            Essayer gratuitement
          </Link>
          <Link className="m-btn m-btn-ghost" href="/methode">
            Voir la méthode
          </Link>
        </div>
        <p className="m-hero-note">Sans carte bancaire · Web et mobile</p>
      </section>

      <div className="m-band">
        <section className="m-section">
          <h2>Ce qui prend du temps aujourd’hui</h2>
          <ul className="m-pain-list">
            <li>« Je passe une heure à préparer chaque séance, souvent la veille au soir. »</li>
            <li>« Je ne sais pas vraiment dire si mon équipe progresse d’un mois à l’autre. »</li>
            <li>« Après le match, je vois bien qu’il faut ajuster — mais quoi, exactement ? »</li>
          </ul>
        </section>
      </div>

      <section className="m-section">
        <h2>La boucle EvolyFoot</h2>
        <p className="m-section-lead">Un fil clair du diagnostic à l’ajustement, que tu peux suivre à ton rythme.</p>
        <div className="m-loop">
          {loop.map((step) => (
            <div className="m-loop-step" key={step.n}>
              <span aria-hidden="true">{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="m-band">
        <section className="m-section">
          <h2>Tout ce qu’il te faut pour la semaine</h2>
          <div className="m-features">
            {features.map((feature) => (
              <div className="m-feature" key={feature.title}>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="m-section">
        <h2>Questions fréquentes</h2>
        <div className="m-faq">
          {faq.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="m-section m-cta-final">
        <h2>Prêt pour ta prochaine séance ?</h2>
        <div className="m-hero-actions">
          <Link className="m-btn m-btn-primary" href="/inscription">
            Créer mon compte
          </Link>
          <Link className="m-btn m-btn-ghost" href="/connexion">
            J’ai déjà un compte
          </Link>
        </div>
      </section>
    </main>
  );
}
