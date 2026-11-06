import { guidedSeasonCycle, parseTrainingSchedule, sortTrainingDays, validateSeasonPriorities } from "@evolyfoot/domain";
import { EducatorNotFoundError, ValidationError } from "./errors";
import type { EducatorRepository, PersistedSeasonProgram, SeasonProgramRepository, TeamRepository, TrainingSessionRepository } from "./repositories";

// Fuseau du club plutôt que celui (souvent UTC) du serveur -- voir le même choix dans match-time.ts.
const clubTimeZone = "Europe/Paris";

// Même jour (dans le fuseau du club) que `date`, à l'heure HH:MM du club.
function atClubTime(date: Date, time: string): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: clubTimeZone, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  const [hours, minutes] = time.split(":").map(Number);
  const guess = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hours, minutes);
  // Décalage du fuseau à cette date (heure d'été ou d'hiver).
  const local = new Date(new Date(guess).toLocaleString("en-US", { timeZone: clubTimeZone }));
  const utc = new Date(new Date(guess).toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(guess - (local.getTime() - utc.getTime()));
}

function readSchedule(value: unknown) {
  try {
    return parseTrainingSchedule(value);
  } catch (error) {
    throw new ValidationError(error instanceof Error ? error.message : "Créneaux invalides.");
  }
}

export class SeasonProgramService {
  constructor(
    private readonly educatorRepository: EducatorRepository,
    private readonly seasonProgramRepository: SeasonProgramRepository,
    // Pour reporter un changement de créneau sur les séances déjà préparées (voir saveSchedule).
    private readonly trainingSessionRepository?: Pick<TrainingSessionRepository, "listByEducator" | "update">,
    private readonly teamRepository?: Pick<TeamRepository, "findForEducator">,
  ) {}

  // Garde la semaine de départ d'une saison déjà lancée : changer de priorités ne remet pas la
  // saison à zéro. Les créneaux récurrents se définissent à la création (facultatif).
  async save(educatorId: string, priorities: unknown, now = new Date(), schedule?: unknown): Promise<PersistedSeasonProgram> {
    const themes = validateSeasonPriorities(priorities);
    const parsedSchedule = readSchedule(schedule);
    if (!(await this.educatorRepository.existsById(educatorId))) {
      throw new EducatorNotFoundError();
    }
    const existing = await this.seasonProgramRepository.findForEducator(educatorId);
    return this.seasonProgramRepository.upsertForEducator(educatorId, themes, existing?.startDate ?? now, parsedSchedule);
  }

  // Heure et lieu se règlent sur le créneau récurrent uniquement : les séances de la saison déjà
  // préparées et à venir suivent le nouveau réglage de leur jour.
  async saveSchedule(educatorId: string, schedule: unknown, now = new Date()): Promise<PersistedSeasonProgram> {
    const parsed = readSchedule(schedule) ?? [];
    const program = await this.seasonProgramRepository.saveSchedule(educatorId, parsed);
    if (!program) {
      throw new ValidationError("Lance d’abord ta saison.");
    }
    if (this.trainingSessionRepository && this.teamRepository) {
      const team = await this.teamRepository.findForEducator(educatorId);
      const days = sortTrainingDays(team?.profile.trainingDays ?? []);
      const sessions = await this.trainingSessionRepository.listByEducator(educatorId);
      for (const session of sessions) {
        if (session.cycleNumber !== guidedSeasonCycle || !session.meetingAt || session.meetingAt.getTime() <= now.getTime()) continue;
        const entry = parsed.find((candidate) => candidate.day === (days[session.slot] ?? days[days.length - 1]));
        if (!entry) continue;
        await this.trainingSessionRepository.update(session.id, educatorId, {
          meetingAt: atClubTime(session.meetingAt, entry.time),
          ...(entry.location ? { location: entry.location } : {}),
        });
      }
    }
    return program;
  }

  get(educatorId: string): Promise<PersistedSeasonProgram | null> {
    return this.seasonProgramRepository.findForEducator(educatorId);
  }
}
