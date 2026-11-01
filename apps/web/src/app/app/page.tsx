import { SidebarNav } from "../sidebar-nav";
import { DashboardView } from "./dashboard-view";

export default function Home() {
  return (
    <main className="shell">
      <SidebarNav />
      <DashboardView />
    </main>
  );
}
