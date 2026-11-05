import { SidebarNav } from "../sidebar-nav";
import { Suspense } from "react";
import { ProfilView } from "./profil-view";

export default function ProfilPage() {
  return (
    <>
      <SidebarNav />
      <Suspense>
        <ProfilView />
      </Suspense>
    </>
  );
}
