import type { PendingChild } from "./joueur/use-player-dashboard";

// Demandes de suivi pas encore acceptées par l'éducateur : le compte ne voit rien de l'enfant d'ici là.
export function WaitingApproval({ pending }: { pending: readonly PendingChild[] }) {
  return (
    <section className="player-space-block waiting-approval" role="status">
      <h2>En attente de validation</h2>
      {pending.length === 0 ? (
        <p>Ton compte est créé. L’éducateur doit accepter ta demande pour que tu voies le suivi de l’enfant.</p>
      ) : (
        <ul>
          {pending.map((child) => (
            <li key={child.playerId}>
              <strong>{child.name}</strong>
              {child.teamName ? ` · ${child.teamName}` : ""} : {child.coachName ?? "L’éducateur"} doit accepter ta demande.
            </li>
          ))}
        </ul>
      )}
      <p className="player-space-note">Tu recevras le suivi dès qu’il l’aura acceptée : reviens un peu plus tard.</p>
    </section>
  );
}
