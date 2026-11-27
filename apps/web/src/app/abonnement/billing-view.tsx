"use client";

import { billingCycleLabels, billingCycles, billingItemLabels, type BillingCycle, type BillingLine } from "@evolyfoot/domain";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export interface BillingState {
  enabled: boolean;
  enforced: boolean;
  canManage: boolean;
  access: { state: "subscribed"; status: string } | { state: "trial"; trialEndsAt: string; daysLeft: number } | { state: "expired"; trialEndsAt: string };
  cycle: BillingCycle | null;
  currentPeriodEnd: string | null;
  cancelAt: string | null;
  extraTeams: number;
  extraCoaches: number;
  quotes: Record<BillingCycle, { lines: BillingLine[]; total: number }>;
}

const statusLabels: Record<string, string> = {
  active: "Actif",
  trialing: "Actif (essai en cours, premier prélèvement à la fin de l’essai)",
  past_due: "Paiement en attente : mets à jour ton moyen de paiement",
};

const cyclePer: Record<BillingCycle, string> = { monthly: "/mois", season: "/saison" };

function euros(value: number): string {
  return `${value.toLocaleString("fr-FR", { minimumFractionDigits: value % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })} €`;
}

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

// Libellé court de l'état de l'abonnement (profil, rappel dans la barre latérale).
export function billingStateLabel(billing: BillingState): string {
  if (billing.access.state === "subscribed") return billing.cancelAt ? "Abonnement résilié" : "Abonnement actif";
  if (billing.access.state === "trial")
    return `Essai gratuit : ${billing.access.daysLeft} jour${billing.access.daysLeft > 1 ? "s" : ""} restant${billing.access.daysLeft > 1 ? "s" : ""}`;
  return "Essai terminé";
}

export async function fetchBilling(): Promise<BillingState | null> {
  const response = await fetch("/api/billing", { cache: "no-store" }).catch(() => null);
  if (!response?.ok) return null;
  const body = (await response.json().catch(() => null)) as { billing?: BillingState } | null;
  return body?.billing ?? null;
}

async function postForUrl(path: string, body?: unknown): Promise<{ url?: string; ok?: boolean; error?: string }> {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) }).catch(() => null);
  if (!response) return { error: "Connexion impossible, réessaie." };
  const payload = (await response.json().catch(() => ({}))) as { url?: string; ok?: boolean; error?: string };
  return response.ok ? payload : { error: payload.error ?? "Une erreur est survenue." };
}

export function BillingView() {
  const params = useSearchParams();
  const [billing, setBilling] = useState<BillingState | null | undefined>(undefined);
  const [cycle, setCycle] = useState<BillingCycle>("season");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [synced, setSynced] = useState(false);
  const [popupDismissed, setPopupDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchBilling().then((state) => {
      if (!cancelled) setBilling(state);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function go(path: string, body?: unknown) {
    setBusy(true);
    setError(null);
    const result = await postForUrl(path, body);
    if (result.url) {
      window.location.assign(result.url);
      return;
    }
    setBusy(false);
    if (result.error) setError(result.error);
    else if (result.ok) setSynced(true);
  }

  if (billing === undefined) return <p className="profil-note">Chargement…</p>;
  if (billing === null) return <p className="profil-note">Impossible de charger ton abonnement pour le moment.</p>;

  const quote = billing.quotes[billing.access.state === "subscribed" && billing.cycle ? billing.cycle : cycle];
  const subscribed = billing.access.state === "subscribed";

  return (
    <>
      {billing.access.state === "expired" && !popupDismissed && (
        <div className="abonnement-popup-overlay" role="presentation">
          <div aria-label="Abonnement nécessaire" aria-modal="true" className="abonnement-popup" role="dialog">
            <p>Ton essai de 14 jours est terminé (ou ton abonnement a pris fin). Abonne-toi pour retrouver un accès complet à EvolyFoot.</p>
            <button className="primary" onClick={() => setPopupDismissed(true)} type="button">
              S’abonner
            </button>
          </div>
        </div>
      )}
      {params.get("resiliation") === "ok" && (
        <p className="abonnement-notice" role="status">
          Résiliation enregistrée : tu gardes l’accès jusqu’à la fin de la période payée. Recharge la page si elle n’apparaît pas encore.
        </p>
      )}
      {params.get("paiement") === "ok" && !subscribed && (
        <p className="abonnement-notice" role="status">
          Paiement reçu : ton abonnement s’active dans quelques instants. Recharge la page si besoin.
        </p>
      )}

      <div className={`abonnement-status abonnement-status-${billing.access.state}`}>
        <strong>{billingStateLabel(billing)}</strong>
        <span>
          {billing.access.state === "subscribed" && billing.cancelAt
            ? `Plus de prélèvement : accès complet jusqu’au ${longDate(billing.cancelAt)}. Tu peux reprendre ton abonnement d’ici là depuis « Gérer mon abonnement ».`
            : billing.access.state === "subscribed"
              ? [
                  statusLabels[billing.access.status] ?? billing.access.status,
                  billing.cycle ? billingCycleLabels[billing.cycle] : null,
                  billing.currentPeriodEnd ? `prochaine échéance le ${longDate(billing.currentPeriodEnd)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : billing.access.state === "trial"
                ? `Accès complet jusqu’au ${longDate(billing.access.trialEndsAt)}, sans carte bancaire. Abonne-toi quand tu veux : le premier prélèvement attend la fin de l’essai.`
                : `Ton essai s’est terminé le ${longDate(billing.access.trialEndsAt)}. Abonne-toi pour continuer à préparer tes séances.`}
        </span>
      </div>

      <section className="abonnement-card">
        <h2>{subscribed ? "Ton abonnement" : "Choisis ton rythme"}</h2>
        {!subscribed && (
          <div aria-label="Rythme de paiement" className="abonnement-cycles" role="radiogroup">
            {billingCycles.map((item) => (
              <button
                aria-checked={item === cycle}
                className={`abonnement-cycle${item === cycle ? " is-selected" : ""}`}
                key={item}
                onClick={() => setCycle(item)}
                role="radio"
                type="button"
              >
                <strong>{billingCycleLabels[item]}</strong>
                <span>
                  {euros(billing.quotes[item].total)}
                  {cyclePer[item]}
                </span>
              </button>
            ))}
          </div>
        )}

        <ul className="abonnement-lines">
          {quote.lines.map((line) => (
            <li key={line.item}>
              <span>
                {billingItemLabels[line.item]}
                {line.quantity > 1 ? ` × ${line.quantity}` : ""}
              </span>
              <span>{euros(line.quantity * line.unitPrice)}</span>
            </li>
          ))}
          <li className="abonnement-total">
            <span>Total</span>
            <span>
              {euros(quote.total)}
              {cyclePer[subscribed && billing.cycle ? billing.cycle : cycle]}
            </span>
          </li>
        </ul>
        {billing.extraTeams + billing.extraCoaches > 0 ? (
          <p className="profil-note">
            {billing.extraTeams} équipe{billing.extraTeams > 1 ? "s" : ""} et {billing.extraCoaches} coach{billing.extraCoaches > 1 ? "s" : ""} en plus de ta
            première équipe. Le total suit tes équipes et tes adjoints.
          </p>
        ) : (
          <p className="profil-note">Une équipe ou un adjoint en plus ? Le total suit tes équipes et tes adjoints.</p>
        )}

        {!billing.canManage ? (
          <p className="profil-note">Seul le coach titulaire de l’équipe gère l’abonnement.</p>
        ) : !billing.enabled ? (
          <p className="profil-note">Le paiement en ligne arrive bientôt : profite de l’accès complet en attendant.</p>
        ) : subscribed ? (
          <div className="abonnement-actions">
            <button className="primary" disabled={busy} onClick={() => go("/api/billing/portal")} type="button">
              Gérer mon abonnement
            </button>
            <button className="secondary" disabled={busy || synced} onClick={() => go("/api/billing/sync")} type="button">
              {synced ? "Abonnement mis à jour" : "Mettre à jour selon mes équipes et adjoints"}
            </button>
            {!billing.cancelAt && (
              <button className="secondary abonnement-cancel" disabled={busy} onClick={() => go("/api/billing/portal", { action: "cancel" })} type="button">
                Résilier mon abonnement
              </button>
            )}
          </div>
        ) : (
          <div className="abonnement-actions">
            <button className="primary" disabled={busy} onClick={() => go("/api/billing/checkout", { cycle })} type="button">
              {busy ? "Redirection…" : `S’abonner : ${euros(quote.total)}${cyclePer[cycle]}`}
            </button>
            <span className="profil-note">Paiement sécurisé par Stripe. Résiliable à tout moment.</span>
          </div>
        )}
        {error && (
          <p className="abonnement-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </>
  );
}
