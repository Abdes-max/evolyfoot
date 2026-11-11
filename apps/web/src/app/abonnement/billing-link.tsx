"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { billingStateLabel, fetchBilling, type BillingState } from "./billing-view";

// Pages encore ouvertes quand l'essai est terminé et que l'accès est bloqué (BILLING_ENFORCED).
const openPaths = ["/abonnement", "/profil"];

// Rappel de l'essai dans la barre latérale (lien vers /abonnement). Quand l'accès est bloqué à la fin de l'essai,
// renvoie vers /abonnement.
export function BillingLink() {
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

  const blocked = billing?.enforced === true && billing.access.state === "expired" && !openPaths.some((path) => window.location.pathname.startsWith(path));
  useEffect(() => {
    if (blocked) window.location.replace("/abonnement");
  }, [blocked]);

  if (!billing || billing.access.state === "subscribed") return null;
  return (
    <Link className={`billing-link billing-link-${billing.access.state}`} href="/abonnement">
      {billingStateLabel(billing)}
      {billing.canManage ? <strong>S’abonner</strong> : null}
    </Link>
  );
}
