"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BallIcon, CalendarIcon, EyeIcon, HomeIcon, UsersIcon } from "./icons";
import { SidebarIdentity } from "./sidebar-identity";

// Auparavant définie une seule fois, en dur, dans page.tsx (l'accueil) : chaque autre page
// (`/plan`, `/bibliotheque`, `/equipe`...) reconstruisait son propre en-tête "retour à l'accueil"
// sans cette navigation, qui disparaissait donc dès qu'on quittait le tableau de bord. Partagée
// ici et rendue sur chaque page qui fait partie de la navigation principale.
// Le plan de progression (/plan) n’est plus dans le menu : ses 4 semaines se retrouvent dans
// Séances ; on y accède depuis la vue d’ensemble et le diagnostic.
const navItems: ReadonlyArray<{ href: string; label: string; icon: typeof HomeIcon }> = [
  { href: "/app", label: "Vue d'ensemble", icon: HomeIcon },
  // La bibliothèque d'exercices n'est pas dans le menu : on y accède depuis la page Séances
  // (elle sert à composer une séance, pas de destination autonome).
  { href: "/seances", label: "Séances", icon: CalendarIcon },
  { href: "/match", label: "Matchs", icon: BallIcon },
  { href: "/observations", label: "Observations", icon: EyeIcon },
  { href: "/equipe", label: "Mon équipe", icon: UsersIcon },
];

export function SidebarNav() {
  // usePathname() est typé comme retournant toujours une chaîne, mais rend `null` hors d'un
  // contexte App Router réel -- notamment en test unitaire (@testing-library/react sans harnais
  // Next), où ce composant est rendu directement sans passer par le routeur.
  const pathname = usePathname() ?? "";

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">EV</span>
        <span>EvolyFoot</span>
      </div>
      <nav aria-label="Navigation principale">
        {navItems.map(({ href, label, icon: Icon }) => {
          // Statistiques et messagerie concernent l’équipe : on y accède depuis Mon équipe, qui reste en surbrillance.
          const isActive =
            href === "/app"
              ? pathname === "/app"
              : pathname.startsWith(href) || (href === "/equipe" && (pathname.startsWith("/statistiques") || pathname.startsWith("/messagerie")));
          return (
            <Link className={isActive ? "nav-item active" : "nav-item"} href={href} key={href}>
              <Icon /> <span className="nav-label">{label}</span>
            </Link>
          );
        })}
      </nav>
      <SidebarIdentity />
    </aside>
  );
}
