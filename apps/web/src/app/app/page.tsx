import { demoFocus, nextSession } from "@evolyfoot/domain";
import Link from "next/link";
import { SidebarNav } from "../sidebar-nav";
import { WeeklyCalendar } from "../weekly-calendar";

const priorities = [
  { label: "Se rendre disponible", score: 78, tone: "strong" },
  { label: "Voir avant de recevoir", score: 61, tone: "developing" },
  { label: "Réagir à la perte", score: 46, tone: "priority" },
];

export default function Home() {
  return (
    <main className="shell">
      <SidebarNav />

      <section className="content">
        <header className="topbar"><div><span className="date">LUNDI 17 AOÛT</span><h1>Bonjour Abdes,</h1><p>Voici l&apos;essentiel pour faire progresser ton équipe cette semaine.</p></div><button className="bell" aria-label="Notifications">Notifications</button></header>

        <section className="hero-grid">
          {/* aria-label court plutôt que laisser le lecteur d'écran énoncer tout le contenu de la
              carte comme nom accessible du lien -- une carte entière cliquable ne doit pas pour
              autant transformer chaque mot qu'elle contient en partie du nom du lien. */}
          <Link aria-label="Voir le plan de progression" className="focus-card card-link" href="/plan">
            <div className="card-top"><span className="eyebrow light">PRIORITÉ DU CYCLE · SEMAINE 3/4</span><span className="trend">En progression</span></div>
            <h2>{demoFocus.label}</h2>
            <p>Faire émerger davantage de soutien proche et de solutions devant le ballon.</p>
            <div className="progress-row"><div className="progress-track"><span style={{ width: `${demoFocus.progress}%` }} /></div><strong>{demoFocus.progress}%</strong></div>
            <div className="focus-footer"><span>{demoFocus.sessionsCompleted}/{demoFocus.sessionsTotal} séances réalisées</span><span aria-hidden="true" className="card-cta">Voir le plan →</span></div>
          </Link>

          <Link aria-label={`Ouvrir la séance : ${nextSession.title}`} className="session-card card-link" href="/session" id="session">
            <div className="card-top"><span className="eyebrow">PROCHAINE SÉANCE</span><span className="date-chip">{nextSession.dateLabel}</span></div>
            <h2>{nextSession.title}</h2>
            <p>Une séance centrée sur les déplacements après la passe et la création de triangles.</p>
            <div className="session-meta"><span>{nextSession.durationMinutes} min</span><span>{nextSession.playerCount} joueurs</span><span>Intensité {nextSession.intensity}</span></div>
            <span aria-hidden="true" className="primary-button">Ouvrir la séance <span>→</span></span>
          </Link>
        </section>

        <section className="section-head"><div><span className="eyebrow">SIGNAL TERRAIN</span><h2>Ce qui mérite ton attention</h2></div><Link className="text-button" href="/observations">Toutes les observations →</Link></section>
        <section className="priority-grid">
          {priorities.map((priority) => (
            <article className="priority-card" key={priority.label}>
              <div className={`score ${priority.tone}`}><strong>{priority.score}</strong><span>/100</span></div>
              <div><h3>{priority.label}</h3><p>{priority.score > 70 ? "Les joueurs créent plus souvent une ligne de passe utile." : priority.score > 50 ? "La prise d'information progresse, mais reste irrégulière sous pression." : "La réaction collective est encore trop tardive après la perte."}</p></div>
              <button aria-label={`Voir ${priority.label}`}>Voir</button>
            </article>
          ))}
        </section>

        <section className="bottom-grid" id="team">
          <article className="insight-card"><div><span className="eyebrow">AJUSTEMENT DE SÉANCE</span><h3>Garde le même thème, change la contrainte.</h3><p>Les dernières observations montrent que le soutien existe sans opposition forte. Mardi, réduis l&apos;espace pour provoquer des décisions plus rapides.</p><div className="actions"><button className="small-primary">Appliquer à la séance</button><button className="small-ghost">Pas maintenant</button></div></div></article>
          <WeeklyCalendar />
        </section>
      </section>
    </main>
  );
}
