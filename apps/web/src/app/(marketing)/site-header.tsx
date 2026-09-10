import Link from "next/link";

// Liens de navigation du site vitrine. Les pages ciblées arrivent dans les PRs suivantes ; le
// header les référence dès maintenant pour figer la structure.
const navLinks = [
  { href: "/educateurs", label: "Éducateurs" },
  { href: "/methode", label: "Méthode" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  return (
    <header className="m-header">
      <Link className="m-brand" href="/">
        <span className="brand-mark">E</span> EvolyFoot
      </Link>
      <nav aria-label="Navigation du site" className="m-nav">
        {navLinks.map((link) => (
          <Link href={link.href} key={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="m-header-actions">
        <Link className="m-btn m-btn-ghost" href="/connexion">
          Ouvrir l’app
        </Link>
        <Link className="m-btn m-btn-primary" href="/inscription">
          Essayer gratuitement
        </Link>
      </div>
    </header>
  );
}
