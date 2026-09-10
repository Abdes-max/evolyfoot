import Link from "next/link";
import { BibliothequeBrowser } from "./bibliotheque-browser";
import { SidebarNav } from "../sidebar-nav";

export default function BibliothequePage() {
  return (
    <>
      <SidebarNav />
      <main className="bibliotheque-shell">
        <header className="bibliotheque-header">
          <Link className="onboarding-brand" href="/">
            <span className="brand-mark">E</span> EvolyFoot
          </Link>
          <div>
            <span className="eyebrow light">Bibliothèque</span>
            <h1>Toutes tes situations d’entraînement.</h1>
            <p>Chaque situation détaille son but, ses règles et ses points de coaching.</p>
          </div>
        </header>
        <BibliothequeBrowser />
      </main>
    </>
  );
}
