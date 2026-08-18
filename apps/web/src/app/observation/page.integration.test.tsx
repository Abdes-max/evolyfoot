import { diagnosticCriteria } from "@evolyfoot/domain";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ObservationPage from "./page";

describe("quick observation", () => {
  it("completes an observation with accessible controls and an optional player signal", () => {
    render(<ObservationPage />);

    const submit = screen.getByRole("button", { name: /valider l’observation/i });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Après un match" }));
    for (const criterion of diagnosticCriteria) {
      const level = screen.getByRole("button", { name: `${criterion.label} : En progrès` });
      expect(level).toHaveAttribute("aria-pressed", "false");
      fireEvent.click(level);
      expect(level).toHaveAttribute("aria-pressed", "true");
    }

    const highlightLina = screen.getByRole("button", { name: /mettre Lina en réussite à retenir/i });
    fireEvent.click(highlightLina);
    expect(highlightLina).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(highlightLina);
    expect(highlightLina).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(highlightLina);

    fireEvent.click(submit);

    expect(screen.getByRole("status")).toHaveTextContent("Tendance en progrès");
    expect(screen.getByRole("status")).toHaveTextContent("1 joueur signalé");
  });
});
