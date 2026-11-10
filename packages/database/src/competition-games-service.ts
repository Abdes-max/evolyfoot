import { parseCompetitionGames, validateCompetitionGames, type CompetitionGame } from "@evolyfoot/domain";
import { PlateauNotFoundError, TournamentNotFoundError, ValidationError } from "./errors";
import type { PlateauRepository, PlayerRepository, TournamentRepository } from "./repositories";
import type { CompetitionKind } from "./competition-convocation-service";

// Rencontres d'un tournoi ou d'un plateau : équipe rencontrée, score, buteurs et passeurs. La liste est
// enregistrée en bloc (le coach en ajoute au fil de la journée) ; les noms des joueurs viennent de l'effectif.
export class CompetitionGamesService {
  constructor(
    private readonly playerRepository: Pick<PlayerRepository, "listByEducator">,
    private readonly tournamentRepository: Pick<TournamentRepository, "findById" | "update">,
    private readonly plateauRepository: Pick<PlateauRepository, "findById" | "update">,
  ) {}

  async save(educatorId: string, kind: CompetitionKind, competitionId: string, value: unknown): Promise<CompetitionGame[]> {
    if (!Array.isArray(value)) {
      throw new ValidationError("Rencontres invalides.");
    }
    const parsed = parseCompetitionGames(value);
    if (parsed.length !== value.length) {
      throw new ValidationError("Rencontres invalides.");
    }
    const repository = kind === "tournament" ? this.tournamentRepository : this.plateauRepository;
    if (!(await repository.findById(competitionId, educatorId))) {
      throw kind === "tournament" ? new TournamentNotFoundError() : new PlateauNotFoundError();
    }
    const roster = new Map((await this.playerRepository.listByEducator(educatorId)).map((player) => [player.id, player.name]));
    const games: CompetitionGame[] = parsed.map((game) => ({
      ...game,
      opponent: game.opponent.trim(),
      // Nom relu dans l'effectif : jamais celui envoyé par le client.
      playerStats: game.playerStats.map((stat) => ({ ...stat, playerName: roster.get(stat.playerId) ?? stat.playerName })),
    }));
    if (games.some((game) => game.playerStats.some((stat) => !roster.has(stat.playerId)))) {
      throw new ValidationError("Un buteur ou un passeur ne fait pas partie de l’effectif.");
    }
    const problem = validateCompetitionGames(games);
    if (problem) {
      throw new ValidationError(problem);
    }
    await repository.update(competitionId, educatorId, { games });
    return games;
  }
}
