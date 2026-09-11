import { BibliothequeBrowser } from "./bibliotheque-browser";
import { SidebarNav } from "../sidebar-nav";

export default function BibliothequePage() {
  return (
    <>
      <SidebarNav />
      <main className="bibliotheque-shell">
        <header className="page-header bibliotheque-header">
          <div>
            <span className="eyebrow light">Bibliothèque</span>
            <h1 title="Toutes tes situations d’entraînement.">Toutes tes situations d’entraînement.</h1>
            <p title="Chaque situation détaille son but, ses règles et ses points de coaching.">
              Chaque situation détaille son but, ses règles et ses points de coaching.
            </p>
          </div>
        </header>
        <BibliothequeBrowser />
      </main>
    </>
  );
}
