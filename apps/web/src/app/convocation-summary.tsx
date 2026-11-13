import { concernedPlayers, summarizeTrainingResponses, type AttendanceEntry, type PlayerSelection } from "@evolyfoot/domain";

// Convocation d'un événement sur sa carte (match, tournoi, plateau), comme dans l'app Coach : envoyée ou
// non, puis présents, absents et sans réponse parmi les joueurs concernés.
export function ConvocationSummary({
  convokedAt,
  attendance,
  selectedPlayerIds,
  roster,
}: {
  convokedAt: string | null | undefined;
  attendance: readonly AttendanceEntry[] | undefined;
  selectedPlayerIds: PlayerSelection | undefined;
  roster: readonly { id: string; name: string }[];
}) {
  if (!convokedAt) {
    return <p className="convocation-summary-pending">Convocation pas encore envoyée</p>;
  }
  const responses = summarizeTrainingResponses(concernedPlayers(roster, selectedPlayerIds ?? null), attendance);
  return (
    <div className="convocation-summary">
      <p className="convocation-summary-sent">Convocation envoyée le {new Date(convokedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</p>
      <p className="convocation-summary-counts">
        <span className="present">{responses.present.length} présents</span>
        <span className="absent">{responses.absent.length} absents</span>
        <span className="pending">{responses.pending.length} sans réponse</span>
      </p>
    </div>
  );
}
