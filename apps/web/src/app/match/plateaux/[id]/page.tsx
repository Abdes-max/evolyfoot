import { CompetitionDetailView } from "../../competition-detail-view";
import { SidebarNav } from "../../../sidebar-nav";

interface PlateauDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PlateauDetailPage({ params }: PlateauDetailPageProps) {
  const { id } = await params;
  return (
    <>
      <SidebarNav />
      <CompetitionDetailView
        backHref="/match"
        competitionId={id}
        endpoint="/api/plateaux"
        itemKey="plateau"
        singular="plateau"
      />
    </>
  );
}
