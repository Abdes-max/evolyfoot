import type { Metadata } from "next";
import { PlayerMessagesView } from "./messages-view";

export const metadata: Metadata = { title: "Messages — EvolyFoot", robots: { index: false } };

export default function PlayerMessagesPage() {
  return <PlayerMessagesView />;
}
