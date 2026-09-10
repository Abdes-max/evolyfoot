import { ObservationDetailView } from "./observation-detail-view";
import { SidebarNav } from "../../sidebar-nav";

interface ObservationDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ObservationDetailPage({ params }: ObservationDetailPageProps) {
  const { id } = await params;
  return (
    <>
      <SidebarNav />
      <ObservationDetailView observationId={id} />
    </>
  );
}
