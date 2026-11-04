import type { Metadata } from "next";
import { Barlow_Condensed, Manrope } from "next/font/google";
import "./globals.css";
import "./observation.css";
import "./session-builder.css";
import "./tactical-diagram.css";
import "./guided-season.css";
import "./bibliotheque.css";
import "./roster.css";
import "./metrics.css";
import "./match.css";
import "./observations.css";
import "./charts.css";
import "./statistics.css";
import "./seances.css";
import "./profil.css";
import "./player-space.css";
import "./messaging.css";
// Chargé en dernier : n'ajoute qu'un `background-image` discret par-dessus le fond déjà posé
// par chaque page (voir page-backgrounds.css).
import "./page-backgrounds.css";
import "./exercise-sheet.css";
import "./design-impact.css";
import { AuthGate } from "./auth-gate";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const barlowCondensed = Barlow_Condensed({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-display", display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://evolyfoot.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "EvolyFoot — Piloter la progression",
  description: "L'assistant de progression des éducateurs de football de jeunes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={`${manrope.variable} ${barlowCondensed.variable}`} lang="fr">
      <body>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
