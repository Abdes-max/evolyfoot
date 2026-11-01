import {
  playerAspectCodes,
  playerEvaluationAspectLabels,
  playerEvaluationAspects,
  playerEvaluationMaxScore,
  playerOverallScore,
  playerPositionCodes,
  type PlayerEvaluationScores,
  type PlayerPosition,
  type PlayerSeasonTotals,
} from "@evolyfoot/domain";

interface PlayerCardProps {
  name: string;
  photo: string | null;
  position: string | null;
  jerseyNumber: string | null;
  preferredFoot: string | null;
  scores: PlayerEvaluationScores | null;
  previousScores: PlayerEvaluationScores | null;
  season: PlayerSeasonTotals;
}

function frenchNumber(value: number): string {
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}

function trendLabel(current: number, previous: number): string {
  const delta = Math.round((current - previous) * 10) / 10;
  if (delta === 0) {
    return "Stable";
  }
  return `${delta > 0 ? "+" : "−"}${frenchNumber(Math.abs(delta))} depuis la dernière évaluation`;
}

// Carte joueur : uniquement ce que l'éducateur a renseigné, aucune note tant qu'il n'a pas évalué.
export function PlayerCard({ name, photo, position, jerseyNumber, preferredFoot, scores, previousScores, season }: PlayerCardProps) {
  const overall = scores ? playerOverallScore(scores) : null;
  const topScore = scores ? Math.max(...playerEvaluationAspects.map((aspect) => scores[aspect])) : null;
  const positionCode = position ? (playerPositionCodes[position as PlayerPosition] ?? position) : null;

  return (
    <div className="player-card-frame">
      <div className="player-card-border">
      <article aria-label={`Carte de ${name}`} className="player-card">
      <div className="player-card-top">
        <div className="player-card-rating">
          <strong aria-label={overall === null ? "Pas encore de note" : `Note ${frenchNumber(overall)} sur ${playerEvaluationMaxScore}`}>
            {overall === null ? "—" : frenchNumber(overall)}
          </strong>
          {positionCode && <span>{positionCode}</span>}
          {jerseyNumber && <small>N° {jerseyNumber}</small>}
        </div>
        <div className="player-card-photo">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={`Photo de ${name}`} src={photo} />
          ) : (
            <span aria-hidden="true">{name.trim().slice(0, 1).toUpperCase() || "?"}</span>
          )}
        </div>
      </div>

      <strong className="player-card-name">{name}</strong>
      {preferredFoot && <small className="player-card-foot">Pied fort : {preferredFoot.toLowerCase()}</small>}

      {scores ? (
        <ul className="player-card-stats">
          {playerEvaluationAspects.map((aspect) => (
            <li className={scores[aspect] === topScore ? "top" : undefined} key={aspect}>
              <strong>{scores[aspect]}</strong>
              <abbr title={playerEvaluationAspectLabels[aspect]}>{playerAspectCodes[aspect]}</abbr>
            </li>
          ))}
        </ul>
      ) : (
        <p className="player-card-empty">La carte se remplit avec la première évaluation.</p>
      )}

      <dl className="player-card-season">
        <div>
          <dd>{season.matches}</dd>
          <dt>Matchs</dt>
        </div>
        <div>
          <dd>{season.goals}</dd>
          <dt>Buts</dt>
        </div>
        <div>
          <dd>{season.assists}</dd>
          <dt>Passes</dt>
        </div>
      </dl>

      {scores && overall !== null && previousScores && (
        <p className="player-card-trend">{trendLabel(overall, playerOverallScore(previousScores))}</p>
      )}
      </article>
      </div>
    </div>
  );
}
