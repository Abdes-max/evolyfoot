import type { Metadata } from "next";
import "./globals.css";

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
