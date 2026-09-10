import { SidebarNav } from "../../sidebar-nav";
import { PlayerDetailView } from "./player-detail-view";

export default async function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <SidebarNav />
      <PlayerDetailView playerId={id} />
    </>
  );
}
