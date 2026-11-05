import { ObservationsListView } from "./observations-list-view";
import { SidebarNav } from "../sidebar-nav";
import { SectionTabs, teamTabs } from "../section-tabs";

export default function ObservationsPage() {
  return (
    <>
      <SidebarNav />
      <SectionTabs label="Sections de l’équipe" tabs={teamTabs} />
      <ObservationsListView />
    </>
  );
}
