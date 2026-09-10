import type { Metadata } from "next";
import { PlaceholderPage } from "../placeholder-page";

export const metadata: Metadata = { title: "Tarifs — EvolyFoot" };

export default function Page() {
  return <PlaceholderPage lead="Un plan gratuit complet pour une équipe ; une offre Premium à venir. Grille détaillée en cours de préparation." title="Tarifs" />;
}
