import { Suspense } from "react";
import { MatchListView } from "./match-list-view";
import { SidebarNav } from "../sidebar-nav";

export default function MatchPage() {
  return (
    <>
      <SidebarNav />
      <Suspense>
        <MatchListView />
      </Suspense>
    </>
  );
}
