import { StatisticsView } from "./statistics-view";
import { SidebarNav } from "../sidebar-nav";
import { SectionTabs, teamTabs } from "../section-tabs";

export default function StatistiquesPage() {
  return (
    <>
      <SidebarNav />
      <SectionTabs label="Sections de l’équipe" tabs={teamTabs} />
      <StatisticsView />
    </>
  );
}
