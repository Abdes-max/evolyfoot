import type { Metadata } from "next";
import { PlaceholderPage } from "../placeholder-page";

export const metadata: Metadata = { title: "À propos d'EvolyFoot — EvolyFoot" };

export default function Page() {
  return <PlaceholderPage lead="Qui construit EvolyFoot et pour qui. Page en cours de rédaction." title="À propos d'EvolyFoot" />;
}
