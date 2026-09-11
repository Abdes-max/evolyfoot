"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Barre de navigation fixe de l'espace joueur/tuteur -- même principe que la barre du bas de
// l'appli coach (.sidebar en position:fixed sous 950px, voir globals.css), mais toujours affichée
// ici : l'espace joueur est déjà pensé mobile d'abord, pas de version "sidebar" desktop.
// Masquée sur une page de détail ouverte depuis un onglet (/joueur/matches/:id) -- même logique
// que match-prep-view.tsx côté coach, qui ne réaffiche pas non plus la nav principale sur une
// page de préparation.
const tabs = [
  { href: "/joueur", label: "Mon enfant", match: (pathname: string) => pathname === "/joueur" },
  { href: "/joueur/calendrier", label: "Calendrier", match: (pathname: string) => pathname.startsWith("/joueur/calendrier") },
  { href: "/joueur/messages", label: "Messages", match: (pathname: string) => pathname.startsWith("/joueur/messages") },
];

export function PlayerTabBar() {
  const pathname = usePathname() ?? "";
  if (pathname.startsWith("/joueur/matches/")) {
    return null;
  }

  return (
    <nav aria-label="Navigation de l’espace joueur" className="player-tab-bar">
      {tabs.map((tab) => (
        <Link className={tab.match(pathname) ? "player-tab active" : "player-tab"} href={tab.href} key={tab.href}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
