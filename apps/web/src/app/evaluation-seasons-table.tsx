import { playerEvaluationAspectLabels, playerEvaluationAspects, type PlayerEvaluationSeason } from "@evolyfoot/domain";

// Progression d'une saison à l'autre, partagée entre la fiche joueur de l'éducateur et l'espace
// joueur : moyenne des évaluations de l'éducateur par aspect, puis écart avec la saison précédente.
export function EvaluationSeasonsTable({ seasons }: { seasons: readonly PlayerEvaluationSeason[] }) {
  return (
    <div className="player-seasons-scroll">
      <table className="player-seasons">
        <thead>
          <tr>
            <th scope="col">Saison</th>
            {playerEvaluationAspects.map((aspect) => (
              <th key={aspect} scope="col">
                {playerEvaluationAspectLabels[aspect]}
              </th>
            ))}
            <th scope="col">Moyenne</th>
            <th scope="col">Écart</th>
          </tr>
        </thead>
        <tbody>
          {seasons.map((season) => (
            <tr key={season.startYear}>
              <th scope="row">
                {season.label}
                <small>
                  {season.count} évaluation{season.count > 1 ? "s" : ""}
                </small>
              </th>
              {playerEvaluationAspects.map((aspect) => (
                <td key={aspect}>{season.averages[aspect].toLocaleString("fr-FR")}</td>
              ))}
              <td>
                <strong>{season.overall.toLocaleString("fr-FR")}</strong>
              </td>
              <td className={season.deltaFromPrevious === null ? "" : season.deltaFromPrevious >= 0 ? "player-seasons-up" : "player-seasons-down"}>
                {season.deltaFromPrevious === null ? "—" : `${season.deltaFromPrevious > 0 ? "+" : ""}${season.deltaFromPrevious.toLocaleString("fr-FR")}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
