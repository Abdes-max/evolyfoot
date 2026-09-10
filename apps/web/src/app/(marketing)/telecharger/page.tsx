import type { Metadata } from "next";
import { PlaceholderPage } from "../placeholder-page";

export const metadata: Metadata = { title: "Télécharger l'application — EvolyFoot" };

export default function Page() {
  return <PlaceholderPage lead="Les liens vers l'app web et les stores mobiles seront publiés ici." title="Télécharger l'application" />;
}
