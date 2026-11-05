"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BallIcon, CalendarIcon, HomeIcon, MessageIcon, PlusIcon, UsersIcon } from "./icons";
import { SidebarIdentity } from "./sidebar-identity";

// Menu principal, partagé par chaque page de l'appli coach. Six entrées : les pages proches sont
// regroupées sous une même entrée et se retrouvent dans ses sous-onglets (voir section-tabs.tsx) --
// Saison couvre la saison guidée, le calendrier des séances et le plan ; Équipe couvre l'effectif,
// les statistiques et les observations.
const navItems: ReadonlyArray<{ href: string; label: string; icon: typeof HomeIcon; matches: readonly string[] }> = [
  { href: "/app", label: "Accueil", icon: HomeIcon, matches: ["/app"] },
  { href: "/saison", label: "Saison", icon: CalendarIcon, matches: ["/saison", "/seances", "/plan", "/session"] },
  { href: "/match", label: "Matchs", icon: BallIcon, matches: ["/match"] },
  { href: "/equipe", label: "Équipe", icon: UsersIcon, matches: ["/equipe", "/statistiques", "/observations", "/observation"] },
  { href: "/messagerie", label: "Messagerie", icon: MessageIcon, matches: ["/messagerie"] },
];

// « Créer » : les points d'entrée de création, auparavant dispersés dans chaque page.
const createItems: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/session", label: "Une séance" },
  { href: "/match?nouveau=1", label: "Un match" },
  { href: "/observation", label: "Une observation" },
  { href: "/bibliotheque#personal-exercises-title", label: "Un exercice" },
];

function isActive(pathname: string, matches: readonly string[]): boolean {
  return matches.some((prefix) => (prefix === "/app" ? pathname === "/app" : pathname === prefix || pathname.startsWith(`${prefix}/`)));
}

export function SidebarNav() {
  // usePathname() est typé comme retournant toujours une chaîne, mais rend `null` hors d'un
  // contexte App Router réel -- notamment en test unitaire (@testing-library/react sans harnais
  // Next), où ce composant est rendu directement sans passer par le routeur.
  const pathname = usePathname() ?? "";
  const [createOpen, setCreateOpen] = useState(false);

  const [home, ...rest] = navItems;
  const renderItem = ({ href, label, icon: Icon, matches }: (typeof navItems)[number]) => (
    <Link className={isActive(pathname, matches) ? "nav-item active" : "nav-item"} href={href} key={href}>
      <Icon /> <span className="nav-label">{label}</span>
    </Link>
  );

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">EV</span>
        <span>EvolyFoot</span>
      </div>
      <nav aria-label="Navigation principale">
        {renderItem(home!)}
        <div className="nav-create">
          <button aria-expanded={createOpen} className="nav-item nav-create-toggle" onClick={() => setCreateOpen((open) => !open)} type="button">
            <PlusIcon /> <span className="nav-label">Créer</span>
          </button>
          {createOpen && (
            <ul className="nav-create-menu">
              {createItems.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} onClick={() => setCreateOpen(false)}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        {rest.map(renderItem)}
      </nav>
      <SidebarIdentity />
    </aside>
  );
}
