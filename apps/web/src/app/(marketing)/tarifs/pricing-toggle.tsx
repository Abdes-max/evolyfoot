"use client";

import { useState } from "react";

// Trois façons de payer Premium, de la moins engageante à la plus économique. Les montants sont
// une proposition de tarification à valider avant mise en production (voir la note sous le
// sélecteur) — rien n'est facturé aujourd'hui, aucun paiement n'est branché.
const cycles = [
  { id: "monthly", label: "Mensuel", price: 9, per: "/mois", note: "Sans engagement, résiliable à tout moment." },
  { id: "annual-monthly", label: "Annuel, prélevé chaque mois", price: 7, per: "/mois", note: "84 €/an, engagement 12 mois — 22 % d’économie vs mensuel." },
  { id: "annual-upfront", label: "Annuel, payé en une fois", price: 4.92, per: "/mois", note: "59 €/an payés en une fois — 45 % d’économie vs mensuel.", badge: "Le moins cher" },
] as const;

export function PricingToggle() {
  const [selected, setSelected] = useState<(typeof cycles)[number]["id"]>("annual-upfront");
  const cycle = cycles.find((item) => item.id === selected)!;

  return (
    <div className="m-pricing-toggle">
      <div className="m-pricing-options" role="radiogroup" aria-label="Fréquence de paiement Premium">
        {cycles.map((item) => (
          <button
            aria-checked={item.id === selected}
            className={`m-pricing-option${item.id === selected ? " is-selected" : ""}`}
            key={item.id}
            onClick={() => setSelected(item.id)}
            role="radio"
            type="button"
          >
            {item.label}
            {"badge" in item && item.badge && <span className="m-pricing-badge">{item.badge}</span>}
          </button>
        ))}
      </div>
      <div className="m-plan-price">
        {cycle.price.toLocaleString("fr-FR", { minimumFractionDigits: cycle.price % 1 === 0 ? 0 : 2 })} €
        <small>{cycle.per} · {cycle.note}</small>
      </div>
    </div>
  );
}
