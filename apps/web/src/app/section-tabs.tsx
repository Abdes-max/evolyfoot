"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Sous-onglets d'une entrée du menu (voir sidebar-nav.tsx) : relient les pages regroupées sous
// Saison ou Équipe, en haut de chacune d'elles.
export const seasonTabs = [
  { href: "/saison", label: "Ma saison" },
  { href: "/seances", label: "Calendrier des séances" },
] as const;

export const teamTabs = [
  { href: "/equipe", label: "Effectif" },
  { href: "/statistiques", label: "Statistiques" },
  { href: "/observations", label: "Observations" },
] as const;

export function SectionTabs({ tabs, label }: { tabs: ReadonlyArray<{ href: string; label: string }>; label: string }) {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label={label} className="section-tabs">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link aria-current={active ? "page" : undefined} className={active ? "section-tab active" : "section-tab"} href={tab.href} key={tab.href}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
