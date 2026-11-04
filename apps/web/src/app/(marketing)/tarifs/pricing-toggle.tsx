"use client";

import Link from "next/link";
import { useState } from "react";

// Tarifs du lancement : on paie dès le premier coach et la première équipe, les équipes et coachs
// suivants coûtent moins cher. Aucun paiement n'est encore branché (voir la note de la page).
const cycles = [
  { id: "monthly", label: "Mensuel", per: "/mois", note: "Sans engagement, résiliable à tout moment." },
  { id: "season", label: "À la saison", per: "/saison", note: "D’août à juin, payé en une fois.", badge: "Le moins cher" },
] as const;

type CycleId = (typeof cycles)[number]["id"];

const prices: Record<"base" | "team" | "coach", Record<CycleId, number>> = {
  base: { monthly: 7.9, season: 59 },
  team: { monthly: 3.9, season: 29 },
  coach: { monthly: 2.9, season: 24 },
};

const included = [
  "Saison guidée de 36 semaines selon tes thèmes prioritaires",
  "72 séances types et bibliothèque d’exercices animés",
  "Diagnostic d’équipe et cycles de 4 semaines",
  "Calendrier, convocations et présences",
  "Observations après séance et ajustements expliqués",
  "Préparation de match et évaluation des joueurs",
  "Accès joueurs et parents, adjoints invités",
  "Web et application EvolyFoot Coach",
];

function format(price: number): string {
  return `${price.toLocaleString("fr-FR", { minimumFractionDigits: price % 1 === 0 ? 0 : 2 })} €`;
}

export function PricingToggle() {
  const [selected, setSelected] = useState<CycleId>("season");
  const cycle = cycles.find((item) => item.id === selected)!;

  return (
    <>
      <div className="m-pricing-toggle">
        <div className="m-pricing-options" role="radiogroup" aria-label="Fréquence de paiement">
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
      </div>

      <div className="m-plans">
        <article className="m-plan m-plan-featured">
          <h3>Coach</h3>
          <div className="m-plan-price">
            {format(prices.base[selected])}
            <small>
              {cycle.per} · 1 coach et 1 équipe · {cycle.note}
            </small>
          </div>
          <p className="m-plan-desc">Tout EvolyFoot pour préparer ta saison, tes séances et suivre chaque joueur.</p>
          <ul>
            {included.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <Link className="m-btn m-btn-primary" href="/inscription">
            Commencer l’essai de 14 jours
          </Link>
        </article>

        <article className="m-plan">
          <h3>Plusieurs équipes, tout le club</h3>
          <p className="m-plan-desc">Le premier coach paie le tarif Coach, tout ce qui s’ajoute coûte moins cher.</p>
          <ul>
            <li>
              Équipe supplémentaire : <strong>+{format(prices.team[selected])}</strong>
              {cycle.per}
            </li>
            <li>
              Coach supplémentaire du même club : <strong>+{format(prices.coach[selected])}</strong>
              {cycle.per}
            </li>
            <li>Partage d’exercices et bibliothèque du club</li>
            <li>Tableau de bord du responsable technique, inclus à partir de 5 coachs</li>
          </ul>
          <Link className="m-btn m-btn-ghost" href="/contact">
            Équiper mon club
          </Link>
        </article>
      </div>
    </>
  );
}
