import type { Metadata } from "next";
import "./marketing.css";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

export const metadata: Metadata = {
  title: "EvolyFoot — Prépare des séances qui font progresser",
  description:
    "EvolyFoot transforme ton diagnostic d’équipe en un cycle de 4 semaines, des séances prêtes à l’emploi et des ajustements expliqués après chaque match. Pour les éducateurs de football U10–U13.",
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="marketing-page">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
