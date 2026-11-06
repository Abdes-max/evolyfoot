import { diagramTargets, trainingActivityCatalogue } from "@evolyfoot/domain";
import Link from "next/link";
import { TacticalDiagramView } from "../tactical-diagram";
import { AuthedRedirect } from "./authed-redirect";
import { HeroPitch } from "./hero-pitch";
import { ScrollEffects } from "./scroll-effects";
import { StoreBadges } from "./store-badges";

// Uniquement des faits vérifiables dans le produit : aucun chiffre d'utilisateurs ou d'avis.
const proofs = [
  { value: trainingActivityCatalogue.length, suffix: "", label: "exercices avec schéma" },
  { value: 4, suffix: " sem.", label: "de cycle, construit sur tes priorités" },
  { value: 7, suffix: "", label: "aspects suivis par joueur" },
  { value: 0, suffix: " €", label: "pour démarrer, sans carte bancaire" },
];

const loop = [
  { n: "1", title: "Diagnostic", text: "Quatre comportements observables, notés au ressenti. Deux priorités en ressortent." },
  { n: "2", title: "Plan 4 semaines", text: "Découvrir, stabiliser, mettre sous pression, évaluer — un cycle construit sur tes priorités." },
  { n: "3", title: "Séance modulable", text: "Une séance prête pour chaque créneau, ajustable en deux clics avant l’entraînement." },
  { n: "4", title: "Observation & ajustement", text: "Après la séance ou le match, un ajustement expliqué — jamais une boîte noire." },
];

const features = [
  {
    title: "Convocations programmées",
    text: "Choisis quand elles partent (la veille, 2 jours avant…) et si les joueurs sont présents par défaut. Avant l’envoi, la séance apparaît « programmée ».",
  },
  { title: "Présents, absents, sans réponse", text: "Les réponses de l’équipe en trois compteurs ; un geste pour voir qui vient, qui manque et pourquoi." },
  {
    title: "Les bons joueurs concernés",
    text: "Coche qui est concerné par un match, un tournoi, un plateau ou les entraînements : eux seuls voient l’événement et reçoivent la convocation.",
  },
  { title: "Préparation de match", text: "Compose ton équipe en touchant le terrain ; change de formation sans perdre les joueurs déjà placés." },
  { title: "Carte joueur", text: "Une carte façon néon avec la photo détourée automatiquement, les notes par aspect et les chiffres de la saison." },
  { title: "Progrès en toile", text: "Chaque évaluation datée en toile d’araignée ; superpose-les pour voir le chemin parcouru." },
  { title: "Saison mois par mois", text: "Toutes les séances de la saison placées dans le calendrier, mois après mois, comme le mois en cours." },
  { title: "Présences & statistiques", text: "La présence se relève à la préparation ; les chiffres de la saison en diagrammes et en rapport." },
  { title: "Deux applis mobiles", text: "EvolyFoot Coach pour le bord du terrain, EvolyFoot Player pour les joueurs et leurs parents." },
];

const audiences = [
  {
    eyebrow: "Éducateurs",
    title: "Prépare, entraîne, ajuste.",
    text: "Un plan clair, des séances prêtes et des décisions expliquées après chaque match.",
    href: "/educateurs",
    cta: "Découvrir l’espace éducateur",
  },
  {
    eyebrow: "Joueurs et tuteurs",
    title: "Suis ta progression.",
    text: "Sur invitation du coach, dans l’appli EvolyFoot Player : calendrier, réponses aux convocations, messages et progrès.",
    href: "/methode",
    cta: "Voir comment ça marche",
  },
];

const faq = [
  { q: "Pour quelle catégorie ?", a: "EvolyFoot est pensé pour le football de jeunes, en particulier les catégories U10 à U13." },
  { q: "Faut-il être diplômé ?", a: "Non. EvolyFoot s’adresse aussi bien aux éducateurs diplômés qu’aux bénévoles qui débutent." },
  { q: "Mes données sont-elles à moi ?", a: "Oui. Ton effectif, tes séances et tes observations t’appartiennent et restent privés." },
  {
    q: "Web ou mobile ?",
    a: "Les deux. L’application web pour préparer, EvolyFoot Coach pour le bord du terrain et EvolyFoot Player pour les joueurs et leurs parents.",
  },
  { q: "Combien de temps pour démarrer ?", a: "Le diagnostic et le premier cycle se font en quelques minutes, avant ta prochaine séance." },
  {
    q: "Combien ça coûte ?",
    a: "14 jours d’essai gratuit sans carte bancaire, puis 7,90 € par mois ou 59 € la saison pour un coach et une équipe. Chaque équipe ou coach en plus coûte moins cher.",
  },
];

const showcase = trainingActivityCatalogue.filter((activity) => activity.kind === "main").slice(0, 12);
const ticker = trainingActivityCatalogue.slice(0, 16).map((activity) => activity.title);

export default function MarketingHome() {
  return (
    <main>
      <AuthedRedirect to="/app" />
      <ScrollEffects />

      <section className="m-impact-hero">
        <div className="m-impact-copy">
          <span className="m-eyebrow">Éducateurs U10–U13</span>
          <h1>
            Prépare des séances qui <em>font progresser</em>, sans y passer tes soirées.
          </h1>
          <p>
            EvolyFoot transforme ton diagnostic d’équipe en un cycle de 4 semaines, des séances prêtes à l’emploi et des ajustements expliqués après chaque
            match.
          </p>
          <div className="m-hero-actions">
            <Link className="m-btn m-btn-primary" href="/inscription">
              Essayer gratuitement
            </Link>
            <Link className="m-btn m-btn-ghost" href="/methode">
              Voir la méthode
            </Link>
          </div>
          <p className="m-hero-note">14 jours d’essai, sans carte bancaire · Web et mobile</p>
          <StoreBadges app="coach" />
        </div>

        <div className="m-impact-visual">
          <div className="m-phone">
            <HeroPitch />
          </div>
          <div className="m-float m-float-top">
            <small>Exemple · Pourquoi cette séance</small>
            <strong>Récupérer rapidement</strong>
            <span>Semaine 1, phase Découvrir</span>
          </div>
          <div className="m-float m-float-bottom">
            <small>Exemple · À observer</small>
            <strong>Le pressing part à deux</strong>
          </div>
        </div>
      </section>

      <ul className="m-proofs">
        {proofs.map((proof) => (
          <li key={proof.label}>
            <strong>
              <span data-count={proof.value}>{proof.value}</span>
              {proof.suffix}
            </strong>
            <span>{proof.label}</span>
          </li>
        ))}
      </ul>

      <div aria-hidden="true" className="m-ticker">
        <div>
          {[...ticker, ...ticker].map((title, index) => (
            <span key={`${title}-${index}`}>{title}</span>
          ))}
        </div>
      </div>

      <section className="m-section m-reveal">
        <h2>Ce qui prend du temps aujourd’hui</h2>
        <ul className="m-pain-list">
          <li>« Je passe une heure à préparer chaque séance, souvent la veille au soir. »</li>
          <li>« Je ne sais pas vraiment dire si mon équipe progresse d’un mois à l’autre. »</li>
          <li>« Après le match, je vois bien qu’il faut ajuster — mais quoi, exactement ? »</li>
        </ul>
      </section>

      <section className="m-section m-reveal">
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

      <section className="m-section m-reveal">
        <h2>Des exercices prêts pour le terrain</h2>
        <p className="m-section-lead">Schéma, consignes et points de coaching : fais glisser pour en voir quelques-uns.</p>
        <ul className="m-showcase" tabIndex={0}>
          {showcase.map((activity) => (
            <li key={activity.id}>
              <TacticalDiagramView diagram={activity.diagram} targets={diagramTargets(activity)} />
              <small>{activity.compatibleThemes[0]}</small>
              <h3>{activity.title}</h3>
              <p>{activity.objective}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="m-section m-reveal">
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

      <section className="m-section m-reveal">
        <h2>Un espace pour chacun</h2>
        <div className="m-audiences">
          {audiences.map((audience) => (
            <Link className="m-audience" href={audience.href} key={audience.eyebrow}>
              <small>{audience.eyebrow}</small>
              <h3>{audience.title}</h3>
              <p>{audience.text}</p>
              <span>{audience.cta} →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="m-section m-reveal">
        <h2>Deux applis, une même équipe</h2>
        <p className="m-section-lead">Tout reste synchronisé avec l’application web : la même équipe, le même plan, les mêmes convocations.</p>
        <div className="m-apps">
          <div className="m-app">
            <small>Pour l’éducateur</small>
            <h3>EvolyFoot Coach</h3>
            <p>Séance du jour, mode terrain, composition, convocations et réponses de l’équipe, au bord du terrain.</p>
            <StoreBadges app="coach" />
          </div>
          <div className="m-app">
            <small>Pour les joueurs et les parents</small>
            <h3>EvolyFoot Player</h3>
            <p>Calendrier, réponse présent ou absent, messages avec le coach, carte joueur et progrès.</p>
            <StoreBadges app="player" />
          </div>
        </div>
      </section>

      <section className="m-section m-reveal">
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

      <section className="m-section m-cta-final m-reveal">
        <h2>Prêt pour ta prochaine séance ?</h2>
        <div className="m-hero-actions">
          <Link className="m-btn m-btn-primary" href="/inscription">
            Créer mon compte
          </Link>
        </div>
      </section>
    </main>
  );
}
