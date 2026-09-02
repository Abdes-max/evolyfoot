import type { Metadata } from "next";
import "./globals.css";
import "./observation.css";
import "./session-builder.css";
import "./tactical-diagram.css";
import "./bibliotheque.css";
import "./roster.css";

export const metadata: Metadata = {
  title: "EvolyFoot — Piloter la progression",
  description: "L'assistant de progression des éducateurs de football de jeunes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
