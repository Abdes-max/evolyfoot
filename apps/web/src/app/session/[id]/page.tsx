import { SidebarNav } from "../../sidebar-nav";
import { SavedSessionView } from "./saved-session-view";

export default async function SavedSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <SidebarNav />
      <SavedSessionView sessionId={id} />
    </>
  );
}
