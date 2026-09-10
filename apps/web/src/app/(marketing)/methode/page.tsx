import type { Metadata } from "next";
import { PlaceholderPage } from "../placeholder-page";

export const metadata: Metadata = { title: "La méthode EvolyFoot — EvolyFoot" };

export default function Page() {
  return <PlaceholderPage lead="Pourquoi un cycle de 4 semaines, et pourquoi chaque ajustement est expliqué plutôt qu'imposé. Page en cours de rédaction." title="La méthode EvolyFoot" />;
}
