import type { Metadata } from "next";
import { Suspense } from "react";
import { SidebarNav } from "../sidebar-nav";
import { BillingView } from "./billing-view";

export const metadata: Metadata = { title: "Abonnement" };

export default function AbonnementPage() {
  return (
    <>
      <SidebarNav />
      <main className="profil-shell">
        <header className="page-header profil-header">
          <div>
            <span className="eyebrow light">Mon compte</span>
            <h1>Abonnement</h1>
            <p>Ton essai, ton abonnement et tes factures.</p>
          </div>
        </header>
        <section className="profil-content abonnement-content">
          <Suspense>
            <BillingView />
          </Suspense>
        </section>
      </main>
    </>
  );
}
