import { diagnosticCriteria } from "@evolyfoot/domain";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ObservationPage from "./page";

describe("quick observation", () => {
  it("initializes a match observation from Next search parameters", async () => {
    render(await ObservationPage({ searchParams: Promise.resolve({ type: "match" }) }));

    expect(screen.getByRole("button", { name: "Après un match" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Après un match" })).toHaveTextContent("Sélectionné");
  });

  it("completes an observation with visible selected states and an optional player signal", async () => {
    render(await ObservationPage({}));

    const submit = screen.getByRole("button", { name: /valider l’observation/i });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Après un match" }));
    for (const criterion of diagnosticCriteria) {
      const level = screen.getByRole("button", { name: `${criterion.label} : En progrès` });
      expect(level).toHaveAttribute("aria-pressed", "false");
      fireEvent.click(level);
      expect(level).toHaveAttribute("aria-pressed", "true");
      expect(level).toHaveTextContent("Sélectionné");
    }

    const highlightLina = screen.getByRole("button", { name: /mettre Lina en réussite à retenir/i });
    fireEvent.click(highlightLina);
    expect(highlightLina).toHaveAttribute("aria-pressed", "true");
    expect(highlightLina).toHaveTextContent("Sélectionné");
    fireEvent.click(highlightLina);
    expect(highlightLina).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(highlightLina);

    fireEvent.click(submit);

    expect(screen.getByRole("status")).toHaveTextContent("Tendance en progrès");
    expect(screen.getByRole("status")).toHaveTextContent("1 joueur signalé");
  });

  it("keeps spaces in a note while the coach is typing", async () => {
    render(await ObservationPage({}));

    const note = screen.getByRole("textbox", { name: /une note si elle aide/i });
    fireEvent.change(note, { target: { value: "  Belle largeur dans les temps  " } });

    expect(note).toHaveValue("  Belle largeur dans les temps  ");
  });
});
