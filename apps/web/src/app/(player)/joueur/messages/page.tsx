import type { Metadata } from "next";
import { PlayerSpaceHeader } from "../../player-space-header";

export const metadata: Metadata = { title: "Messages — EvolyFoot", robots: { index: false } };

// Onglet "Messages" (voir player-tab-bar.tsx) : pas encore construit -- messagerie coach ↔
// joueur/tuteur, chantier à part (modèle de conversation, boîte de réception côté coach).
// Placeholder honnête plutôt qu'un onglet qui semblerait cassé une fois affiché.
export default function PlayerMessagesPage() {
  return (
    <div className="player-space">
      <PlayerSpaceHeader />
      <main className="player-space-content">
        <section className="player-space-block">
          <h2>Messages</h2>
          <p className="player-space-empty">
            La messagerie avec l’éducateur arrive bientôt. En attendant, contacte-le directement en dehors de
            l’application.
          </p>
        </section>
      </main>
    </div>
  );
}
