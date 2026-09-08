import { MatchPrepView } from "./match-prep-view";
import { SidebarNav } from "../../sidebar-nav";

interface MatchDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function MatchDetailPage({ params }: MatchDetailPageProps) {
  const { id } = await params;
  return (
    <>
      <SidebarNav />
      <MatchPrepView matchId={id} />
    </>
  );
}
