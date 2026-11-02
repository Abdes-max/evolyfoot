import { colors } from "@evolyfoot/design-tokens";
import type { ObservationEventType, ObservationLevel } from "@evolyfoot/domain";

export const eventTypeLabel: Record<ObservationEventType, string> = { training: "Séance", match: "Match" };
export const levelLabel: Record<ObservationLevel, string> = { reinforce: "À renforcer", progress: "En progrès", achieved: "Acquis" };
export const levelColor: Record<ObservationLevel, string> = { reinforce: colors.danger, progress: colors.primary, achieved: colors.ink };
