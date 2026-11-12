import { parseCompetitionLineup, validateCompetitionLineup, type CompetitionLineup } from "@evolyfoot/domain";
import { PlateauNotFoundError, TournamentNotFoundError, ValidationError } from "./errors";
import type { PlateauRepository, PlayerRepository, TournamentRepository } from "./repositories";
import type { CompetitionKind } from "./competition-convocation-service";

// Composition d'un tournoi ou d'un plateau, enregistrée en bloc à chaque changement sur le terrain.
// Les joueurs viennent de l'effectif : les noms sont relus côté serveur.
export class CompetitionLineupService {
  constructor(
    private readonly playerRepository: Pick<PlayerRepository, "listByEducator">,
    private readonly tournamentRepository: Pick<TournamentRepository, "findById" | "update">,
    private readonly plateauRepository: Pick<PlateauRepository, "findById" | "update">,
  ) {}

  async save(educatorId: string, kind: CompetitionKind, competitionId: string, value: unknown): Promise<CompetitionLineup> {
    const parsed = parseCompetitionLineup(value);
    if (!parsed) {
      throw new ValidationError("Composition invalide.");
    }
    const repository = kind === "tournament" ? this.tournamentRepository : this.plateauRepository;
    const competition = await repository.findById(competitionId, educatorId);
    if (!competition) {
      throw kind === "tournament" ? new TournamentNotFoundError() : new PlateauNotFoundError();
    }
    if (competition.cancelledAt) {
      throw new ValidationError(`Ce ${kind === "tournament" ? "tournoi" : "plateau"} est annulé : rétablis-le d’abord.`);
    }
    const roster = new Map((await this.playerRepository.listByEducator(educatorId)).map((player) => [player.id, player.name]));
    const playerIds = [...parsed.lineup.map((assignment) => assignment.playerId), ...parsed.substitutePlayerIds];
    if (playerIds.some((playerId) => !roster.has(playerId))) {
      throw new ValidationError("Un joueur de la composition ne fait pas partie de l’effectif.");
    }
    const lineup: CompetitionLineup = {
      ...parsed,
      lineup: parsed.lineup.map((assignment) => ({ ...assignment, playerName: roster.get(assignment.playerId)! })),
    };
    const problem = validateCompetitionLineup(lineup);
    if (problem) {
      throw new ValidationError(problem);
    }
    await repository.update(competitionId, educatorId, { lineup });
    return lineup;
  }
}
