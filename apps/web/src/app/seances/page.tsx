import { SidebarNav } from "../sidebar-nav";
import { SeancesView } from "./seances-view";
import { SectionTabs, seasonTabs } from "../section-tabs";

export default function SeancesPage() {
  return (
    <>
      <SidebarNav />
      <SectionTabs label="Sections de la saison" tabs={seasonTabs} />
      <SeancesView />
    </>
  );
}
