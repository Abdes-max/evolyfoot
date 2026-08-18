import type { AdjustmentSuggestion } from "@evolyfoot/domain";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdjustmentCard } from "./adjustment-card";

const suggestion: AdjustmentSuggestion = {
  id: "adjustment-observation-1",
  action: "reinforce",
  title: "Renforcer · Réagir après la perte",
  reason: "Réagir après la perte est à 0/100. Le comportement sera répété dans une situation plus lisible avant d'ajouter de la pression.",
  triggerScore: 0,
  proposedTheme: "Récupérer rapidement",
  constraint: "Espace légèrement agrandi.",
  observable: "Le comportement « Réagir après la perte » apparaît dans des situations lisibles.",
  impact: "Davantage de répétitions courtes avant d'augmenter la pression.",
};

describe("AdjustmentCard", () => {
  it("explains a collective adjustment and lets the coach accept then undo it without losing focus", async () => {
    render(<AdjustmentCard suggestion={suggestion} />);

    expect(screen.getByText(/0\/100/)).toBeVisible();
    expect(screen.getByRole("heading", { name: "Pourquoi" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Ce qui change" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "À observer" })).toBeVisible();
    expect(screen.getByText(suggestion.reason).closest("article")).not.toHaveTextContent("Lina");

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
