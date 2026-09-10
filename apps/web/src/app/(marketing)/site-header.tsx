"use client";

import Link from "next/link";
import { useState } from "react";

const navLinks = [
  { href: "/educateurs", label: "Éducateurs" },
  { href: "/methode", label: "Méthode" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="m-header">
      <Link className="m-brand" href="/" onClick={() => setOpen(false)}>
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

      <button
        aria-expanded={open}
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        className="m-menu-toggle"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span aria-hidden="true">{open ? "✕" : "☰"}</span>
      </button>

      {open && (
        <div className="m-menu-panel">
          {navLinks.map((link) => (
            <Link href={link.href} key={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
          <Link className="m-btn m-btn-ghost" href="/connexion" onClick={() => setOpen(false)}>
            Ouvrir l’app
          </Link>
          <Link className="m-btn m-btn-primary" href="/inscription" onClick={() => setOpen(false)}>
            Essayer gratuitement
          </Link>
        </div>
      )}
    </header>
  );
}
