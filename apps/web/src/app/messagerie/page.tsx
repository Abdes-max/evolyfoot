import { Suspense } from "react";
import { SidebarNav } from "../sidebar-nav";
import { MessagerieView } from "./messagerie-view";

export default function MessageriePage() {
  return (
    <>
      <SidebarNav />
      <Suspense>
        <MessagerieView />
      </Suspense>
    </>
  );
}
