import type { Metadata } from "next";
import { PlaceholderPage } from "../placeholder-page";

export const metadata: Metadata = { title: "Nous contacter — EvolyFoot" };

export default function Page() {
  return <PlaceholderPage lead="Un formulaire de contact arrive bientôt. En attendant, écris-nous à contact@evolyfoot.com." title="Nous contacter" />;
}
