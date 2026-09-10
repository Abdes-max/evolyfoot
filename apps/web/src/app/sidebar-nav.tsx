"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BallIcon, CalendarIcon, ChartIcon, EyeIcon, HomeIcon, TargetIcon, UsersIcon } from "./icons";
import { SidebarIdentity } from "./sidebar-identity";

// Auparavant définie une seule fois, en dur, dans page.tsx (l'accueil) : chaque autre page
// (`/plan`, `/bibliotheque`, `/equipe`...) reconstruisait son propre en-tête "retour à l'accueil"
// sans cette navigation, qui disparaissait donc dès qu'on quittait le tableau de bord. Partagée
// ici et rendue sur chaque page qui fait partie de la navigation principale.
const navItems: ReadonlyArray<{ href: string; label: string; icon: typeof HomeIcon }> = [
  { href: "/", label: "Vue d'ensemble", icon: HomeIcon },
  { href: "/plan", label: "Plan de progression", icon: TargetIcon },
  // La bibliothèque d'exercices n'est pas dans le menu : on y accède depuis la page Séances
  // (elle sert à composer une séance, pas de destination autonome).
  { href: "/seances", label: "Séances", icon: CalendarIcon },
  { href: "/match", label: "Matchs", icon: BallIcon },
  { href: "/observations", label: "Observations", icon: EyeIcon },
  { href: "/statistiques", label: "Statistiques", icon: ChartIcon },
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
        <span className="brand-mark">E</span>
        <span>EvolyFoot</span>
      </div>
      <nav aria-label="Navigation principale">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
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
