import Link from "next/link";

// Gabarit provisoire pour les pages vitrine dont le contenu détaillé arrive dans les PRs
// suivantes (Éducateurs, Méthode, Tarifs, À propos, Contact, légales…). Garde une navigation
// cohérente sans promettre un contenu qui n'existe pas encore.
export function PlaceholderPage({ title, lead }: { title: string; lead: string }) {
  return (
    <main>
      <section className="m-section m-hero">
        <span className="m-eyebrow">Bientôt</span>
        <h1>{title}</h1>
        <p>{lead}</p>
        <div className="m-hero-actions">
          <Link className="m-btn m-btn-primary" href="/inscription">
            Essayer gratuitement
          </Link>
          <Link className="m-btn m-btn-ghost" href="/">
            Retour à l’accueil
          </Link>
        </div>
      </section>
    </main>
  );
}
