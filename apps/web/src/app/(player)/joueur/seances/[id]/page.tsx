import type { Metadata } from "next";
import { TrainingSessionDetailView } from "./training-session-detail-view";

export const metadata: Metadata = { title: "Séance — EvolyFoot", robots: { index: false } };

export default async function PlayerTrainingSessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TrainingSessionDetailView sessionId={id} />;
}
