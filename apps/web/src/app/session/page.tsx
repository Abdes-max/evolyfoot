import { SessionView } from "./session-view";
import { trainingCycleWeekCount } from "./cycle";

function parseWeek(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= trainingCycleWeekCount ? parsed : 1;
}

function parseSlot(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export default async function SessionPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; slot?: string }>;
}) {
  const { week, slot } = await searchParams;
  return <SessionView slot={parseSlot(slot)} weekNumber={parseWeek(week)} />;
}
