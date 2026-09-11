"use client";

import { MessagingThread } from "../../../messaging-thread";
import { PlayerSpaceHeader } from "../../player-space-header";
import { usePlayerDashboard } from "../use-player-dashboard";

// Onglet "Messages" (voir player-tab-bar.tsx) : fil de discussion avec l'éducateur, un seul par
// joueur (voir messaging-thread.tsx, réutilisé côté fiche joueur du coach).
export function PlayerMessagesView() {
  const { dashboard } = usePlayerDashboard();

  return (
    <div className="player-space">
      <PlayerSpaceHeader />
      <main className="player-space-content">
        <section className="player-space-block">
          <h2>Messages{dashboard?.team ? ` avec ${dashboard.team.name}` : ""}</h2>
          <MessagingThread fetchUrl="/api/joueur/messages" sendUrl="/api/joueur/messages" viewerRole="player" />
        </section>
      </main>
    </div>
  );
}
