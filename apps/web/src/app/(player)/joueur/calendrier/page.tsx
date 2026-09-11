import type { Metadata } from "next";
import { PlayerCalendarView } from "./calendar-view";

export const metadata: Metadata = { title: "Calendrier — EvolyFoot", robots: { index: false } };

export default function PlayerCalendarPage() {
  return <PlayerCalendarView />;
}
