"use client";

import type { AdjustmentSuggestion } from "@evolyfoot/domain";
import { useEffect, useRef, useState } from "react";

type Decision = "pending" | "accepted" | "declined";

interface AdjustmentCardProps {
  suggestion: AdjustmentSuggestion;
}

export function AdjustmentCard({ suggestion }: AdjustmentCardProps) {
  const [decision, setDecision] = useState<Decision>("pending");
  const applyButton = useRef<HTMLButtonElement>(null);
  const decisionButton = useRef<HTMLButtonElement>(null);
  const isInitialRender = useRef(true);

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    if (decision === "pending") applyButton.current?.focus();
    else decisionButton.current?.focus();
  }, [decision]);

  const status = decision === "accepted"
    ? "Ajustement appliqué à la prochaine séance"
    : decision === "declined"
      ? "Plan actuel conservé"
      : "";

  return (
    <section className="adjustment-card" aria-labelledby="adjustment-card-title">
      <div className="adjustment-card-heading">
        <span className="eyebrow">PROPOSITION POUR LA PROCHAINE SÉANCE</span>
        <h3 id="adjustment-card-title">{suggestion.title}</h3>
      </div>

      <div className="adjustment-card-details">
        <section>
          <h4>Pourquoi</h4>
          <p>{suggestion.reason}</p>
        </section>
        <section>
          <h4>Ce qui change</h4>
          <p>{`${suggestion.proposedTheme} · ${suggestion.constraint}`}</p>
          <p>{suggestion.impact}</p>
        </section>
        <section>
          <h4>À observer</h4>
          <p>{suggestion.observable}</p>
        </section>
      </div>

      <p aria-atomic="true" aria-live="polite" className="adjustment-card-status" role="status">{status}</p>
      <div className="adjustment-card-actions">
        {decision === "pending" && <>
          <button className="adjustment-card-apply" onClick={() => setDecision("accepted")} ref={applyButton} type="button">Appliquer cet ajustement</button>
          <button onClick={() => setDecision("declined")} type="button">Garder mon plan</button>
        </>}
        {decision === "accepted" && <button onClick={() => setDecision("pending")} ref={decisionButton} type="button">Annuler</button>}
        {decision === "declined" && <button onClick={() => setDecision("pending")} ref={decisionButton} type="button">Reconsidérer la proposition</button>}
      </div>
    </section>
  );
}
