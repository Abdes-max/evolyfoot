"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { billingStateLabel, fetchBilling, type BillingState } from "./billing-view";

// Encart d'abonnement dans la bannière du profil.
export function BillingPlan() {
  const [billing, setBilling] = useState<BillingState | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchBilling().then((state) => {
      if (!cancelled) setBilling(state);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="profil-plan">
      <span className="profil-plan-name">{billing?.access.state === "subscribed" ? "Abonnement Coach" : "Essai gratuit"}</span>
      <span className="profil-plan-note">{billing ? billingStateLabel(billing) : "…"}</span>
      <Link className="profil-plan-cta" href="/abonnement">
        {billing?.access.state === "subscribed" ? "Mon abonnement" : "S’abonner"}
      </Link>
    </div>
  );
}
