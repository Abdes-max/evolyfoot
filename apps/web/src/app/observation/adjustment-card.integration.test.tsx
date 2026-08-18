import {
  completeObservation,
  createObservationDraft,
  diagnosticCriteria,
  rateObservation,
  suggestAdjustmentFromObservation,
  togglePlayerSignal,
  type DevelopmentWeek,
} from "@evolyfoot/domain";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdjustmentCard } from "./adjustment-card";

const currentWeek: DevelopmentWeek = {
  week: 2,
  phase: "Stabiliser",
  theme: "Progresser ensemble",
  intention: "Répéter le comportement dans des situations variées.",
  observable: "Le comportement apparaît sans rappel dans 1 action sur 2.",
};

function suggestionFromObservationWithPlayerSignal() {
  const player = { id: "player-lina", name: "Lina" };
  let draft = createObservationDraft("training", "Observation de séance", [player]);
  for (const criterion of diagnosticCriteria) {
    draft = rateObservation(draft, criterion.id, criterion.id === "reactionAfterLoss" ? "reinforce" : "progress");
  }
  const report = completeObservation(togglePlayerSignal(draft, player, "highlight"));
  return suggestAdjustmentFromObservation(report, currentWeek);
}

describe("AdjustmentCard", () => {
  it("explains a collective adjustment and lets the coach accept then undo it without losing focus", async () => {
    const suggestion = suggestionFromObservationWithPlayerSignal();
    render(<AdjustmentCard suggestion={suggestion} />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText(/0\/100/)).toBeVisible();
    expect(screen.getByRole("heading", { name: "Pourquoi" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Ce qui change" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "À observer" })).toBeVisible();
    expect(screen.queryByText("Lina")).not.toBeInTheDocument();

    const apply = screen.getByRole("button", { name: "Appliquer cet ajustement" });
    apply.focus();
    fireEvent.click(apply);

    expect(screen.getByRole("status")).toHaveTextContent("Ajustement appliqué à la prochaine séance");
    await waitFor(() => expect(screen.getByRole("button", { name: "Annuler" })).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    const reconsideredApply = screen.getByRole("button", { name: "Appliquer cet ajustement" });
    expect(screen.getByRole("button", { name: "Garder mon plan" })).toBeEnabled();
    await waitFor(() => expect(reconsideredApply).toHaveFocus());
  });

  it("lets the coach decline then reconsider the local suggestion", async () => {
    const suggestion = suggestionFromObservationWithPlayerSignal();
    render(<AdjustmentCard suggestion={suggestion} />);

    const decline = screen.getByRole("button", { name: "Garder mon plan" });
    decline.focus();
    fireEvent.click(decline);

    expect(screen.getByRole("status")).toHaveTextContent("Plan actuel conservé");
    await waitFor(() => expect(screen.getByRole("button", { name: "Reconsidérer la proposition" })).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: "Reconsidérer la proposition" }));

    const apply = screen.getByRole("button", { name: "Appliquer cet ajustement" });
    expect(screen.getByRole("button", { name: "Garder mon plan" })).toBeEnabled();
    await waitFor(() => expect(apply).toHaveFocus());
  });
});
