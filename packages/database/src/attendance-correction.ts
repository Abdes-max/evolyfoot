import { buildAttendanceEntries, concernedPlayers, mergeAttendance } from "@evolyfoot/domain";
import type { AttendanceEntry, PlayerSelection } from "@evolyfoot/domain";
import { ValidationError } from "./errors";
import type { PlayerRepository } from "./repositories";

// Présences corrigées par l'éducateur une fois l'événement terminé : vérifie les joueurs contre
// l'effectif (et la sélection de l'événement), prend les noms de l'effectif et fusionne avec les
// présences existantes -- les joueurs non corrigés gardent leur réponse.
export async function correctAttendance(input: {
  playerRepository: Pick<PlayerRepository, "listByEducator"> | undefined;
  educatorId: string;
  selectedPlayerIds: PlayerSelection | undefined;
  existing: readonly AttendanceEntry[] | undefined;
  updates: unknown;
}): Promise<AttendanceEntry[]> {
  if (!input.playerRepository) {
    throw new ValidationError("La saisie des présences n’est pas disponible ici.");
  }
  const roster = await input.playerRepository.listByEducator(input.educatorId);
  const concerned = concernedPlayers(roster, input.selectedPlayerIds);
  try {
    return mergeAttendance(input.existing, buildAttendanceEntries(input.updates, concerned));
  } catch (error) {
    throw new ValidationError(error instanceof Error ? error.message : "Présences invalides.");
  }
}
