import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="m-footer">
      <div className="m-section">
        <div className="m-footer-col">
          <Link className="m-brand" href="/">
            <span className="brand-mark">E</span> EvolyFoot
          </Link>
          <span style={{ color: "var(--m-muted)", fontSize: 12.5 }}>
            L’assistant de progression des éducateurs de football de jeunes.
          </span>
        </div>
        <div className="m-footer-col">
          <strong>Produit</strong>
          <Link href="/educateurs">Éducateurs</Link>
          <Link href="/methode">Méthode</Link>
          <Link href="/tarifs">Tarifs</Link>
          <Link href="/telecharger">Télécharger</Link>
        </div>
        <div className="m-footer-col">
          <strong>EvolyFoot</strong>
          <Link href="/a-propos">À propos</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/connexion">Ouvrir l’app</Link>
        </div>
        <div className="m-footer-col">
          <strong>Légal</strong>
          <Link href="/mentions-legales">Mentions légales</Link>
          <Link href="/confidentialite">Confidentialité</Link>
          <Link href="/cgu">CGU</Link>
        </div>
        <p className="m-footer-legal">© {new Date().getFullYear()} EvolyFoot. Tous droits réservés.</p>
      </div>
    </footer>
  );
}
