import { parsePlayerSelection } from "@evolyfoot/domain";
import type { PlayerSelection } from "@evolyfoot/domain";
import { ValidationError } from "./errors";
import type { PlayerRepository } from "./repositories";

// Joueurs concernés reçus d'un formulaire, vérifiés contre l'effectif de l'éducateur (voir
// parsePlayerSelection) : `undefined` = inchangé.
export async function readPlayerSelection(
  playerRepository: Pick<PlayerRepository, "listByEducator"> | undefined,
  educatorId: string,
  value: unknown,
): Promise<PlayerSelection | undefined> {
  if (value === undefined) {
    return undefined;
  }
  if (!playerRepository) {
    throw new ValidationError("Le choix des joueurs n’est pas disponible ici.");
  }
  const roster = await playerRepository.listByEducator(educatorId);
  try {
    return parsePlayerSelection(
      value,
      roster.map((player) => player.id),
    );
  } catch (error) {
    throw new ValidationError(error instanceof Error ? error.message : "Liste de joueurs invalide.");
  }
}
