import { SavedSessionView } from "./saved-session-view";

export default async function SavedSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SavedSessionView sessionId={id} />;
}
