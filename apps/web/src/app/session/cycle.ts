export { currentCycleWeek, firstFreeCycleSlot, suggestedMeetingAt, trainingCycleWeekCount } from "@evolyfoot/domain";
import { trainingCycleWeekCount } from "@evolyfoot/domain";

export function cycleWeekLabel(weekNumber: number): string {
  return `Semaine ${weekNumber} sur ${trainingCycleWeekCount}`;
}
