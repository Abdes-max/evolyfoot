import { RosterView } from "./roster-view";
import { SectionTabs, teamTabs } from "../section-tabs";

export default function EquipePage() {
  return (
    <>
      <SectionTabs label="Sections de l’équipe" tabs={teamTabs} />
      <RosterView />
    </>
  );
}
