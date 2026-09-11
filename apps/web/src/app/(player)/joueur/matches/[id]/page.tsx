import type { Metadata } from "next";
import { MatchDetailView } from "./match-detail-view";

export const metadata: Metadata = { title: "Match — EvolyFoot", robots: { index: false } };

export default async function PlayerMatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MatchDetailView matchId={id} />;
}
