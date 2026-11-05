import { SidebarNav } from "../sidebar-nav";
import { SaisonView } from "./saison-view";
import { SectionTabs, seasonTabs } from "../section-tabs";

export default function SaisonPage() {
  return (
    <>
      <SidebarNav />
      <SectionTabs label="Sections de la saison" tabs={seasonTabs} />
      <SaisonView />
    </>
  );
}
