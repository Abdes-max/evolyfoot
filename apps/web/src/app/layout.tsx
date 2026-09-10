import type { Metadata } from "next";
import "./globals.css";
import "./observation.css";
import "./session-builder.css";
import "./tactical-diagram.css";
import "./bibliotheque.css";
import "./roster.css";
import "./metrics.css";
import "./match.css";
import "./observations.css";
import "./charts.css";
import "./statistics.css";
import "./seances.css";
import "./profil.css";
// Chargé en dernier : n'ajoute qu'un `background-image` discret par-dessus le fond déjà posé
// par chaque page (voir page-backgrounds.css).
import "./page-backgrounds.css";
import { AuthGate } from "./auth-gate";

export const metadata: Metadata = {
  title: "EvolyFoot — Piloter la progression",
  description: "L'assistant de progression des éducateurs de football de jeunes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
