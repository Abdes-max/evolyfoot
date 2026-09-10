import type { Metadata } from "next";
import { PlaceholderPage } from "../placeholder-page";

export const metadata: Metadata = { title: "Mentions légales — EvolyFoot" };

export default function Page() {
  return <PlaceholderPage lead="Contenu légal à compléter." title="Mentions légales" />;
}
