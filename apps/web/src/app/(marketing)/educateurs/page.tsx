import type { Metadata } from "next";
import { PlaceholderPage } from "../placeholder-page";

export const metadata: Metadata = { title: "Pour les éducateurs — EvolyFoot" };

export default function Page() {
  return <PlaceholderPage lead="Le détail de chaque fonctionnalité, dans l'ordre de la boucle EvolyFoot. Contenu en cours de rédaction." title="Pour les éducateurs" />;
}
