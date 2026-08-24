import { demoFocus, demoTeam, nextSession } from "@evolyfoot/domain";

const priorities = [
  { label: "Se rendre disponible", score: 78, tone: "strong" },
  { label: "Voir avant de recevoir", score: 61, tone: "developing" },
  { label: "Réagir à la perte", score: 46, tone: "priority" },
];

export default function Home() {
  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">E</span><span>EvolyFoot</span></div>
        <nav aria-label="Navigation principale">
          <a className="nav-item active" href="#">Vue d&apos;ensemble</a>
          <a className="nav-item" href="#plan">Plan de progression</a>
          <a className="nav-item" href="#session">Séances</a>
          <a className="nav-item" href="#observations">Observations</a>
          <a className="nav-item" href="/onboarding">Mon équipe</a>
        </nav>
        <div className="season-card">
          <span className="eyebrow">SAISON 2026-27</span>
          <strong>{demoTeam.name} · {demoTeam.ageGroup}</strong>
          <span>{demoTeam.playerCount} joueurs</span>
        </div>
        <div className="coach"><span className="avatar">AM</span><div><strong>Abdes</strong><span>Éducateur</span></div><button aria-label="Paramètres">•••</button></div>
      </aside>

      <section className="content">
        <header className="topbar"><div><span className="date">LUNDI 17 AOÛT</span><h1>Bonjour Abdes,</h1><p>Voici l&apos;essentiel pour faire progresser ton équipe cette semaine.</p></div><button className="bell" aria-label="Notifications">◦</button></header>

        <section className="hero-grid">
          <article className="focus-card" id="plan">
            <div className="card-top"><span className="eyebrow light">PRIORITÉ DU CYCLE · SEMAINE 3/4</span><span className="trend">En progression</span></div>
            <h2>{demoFocus.label}</h2>
            <p>Faire émerger davantage de soutien proche et de solutions devant le ballon.</p>
            <div className="progress-row"><div className="progress-track"><span style={{ width: `${demoFocus.progress}%` }} /></div><strong>{demoFocus.progress}%</strong></div>
            <div className="focus-footer"><span>{demoFocus.sessionsCompleted}/{demoFocus.sessionsTotal} séances réalisées</span><a href="#observations">Voir le plan →</a></div>
          </article>

          <article className="session-card" id="session">
            <div className="card-top"><span className="eyebrow">PROCHAINE SÉANCE</span><span className="date-chip">{nextSession.dateLabel}</span></div>
            <h2>{nextSession.title}</h2>
            <p>Une séance centrée sur les déplacements après la passe et la création de triangles.</p>
            <div className="session-meta"><span>{nextSession.durationMinutes} min</span><span>{nextSession.playerCount} joueurs</span><span>Intensité {nextSession.intensity}</span></div>
            <button className="primary-button">Ouvrir la séance <span>→</span></button>
          </article>
        </section>

        <section className="section-head" id="observations"><div><span className="eyebrow">SIGNAL TERRAIN</span><h2>Ce qui mérite ton attention</h2></div><button className="text-button">Toutes les observations →</button></section>
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
          <article className="week-card"><div className="card-top"><div><span className="eyebrow">RYTHME DE LA SEMAINE</span><h3>2 temps forts</h3></div><span className="mini-badge">S33</span></div><div className="timeline"><div><span className="dot filled"/><p><strong>Mardi</strong><small>Séance · 18:00</small></p></div><div><span className="dot"/><p><strong>Samedi</strong><small>Match vs. US Vallée · 10:30</small></p></div></div><a className="match-observation-link" href="/observation?type=match">Observer un match →</a></article>
        </section>
      </section>
    </main>
  );
}
