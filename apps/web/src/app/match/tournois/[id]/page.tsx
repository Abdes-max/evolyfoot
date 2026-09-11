import { CompetitionDetailView } from "../../competition-detail-view";
import { SidebarNav } from "../../../sidebar-nav";

interface TournamentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TournamentDetailPage({ params }: TournamentDetailPageProps) {
  const { id } = await params;
  return (
    <>
      <SidebarNav />
      <CompetitionDetailView
        backHref="/match"
        competitionId={id}
        endpoint="/api/tournaments"
        itemKey="tournament"
        singular="tournoi"
      />
    </>
  );
}
