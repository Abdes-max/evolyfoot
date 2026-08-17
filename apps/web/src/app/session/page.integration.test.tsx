import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SessionPage from "./page";

describe("session builder", () => {
  it("recalcule la durée et valide une séance modifiée", () => {
    render(<SessionPage />);

    expect(screen.getByText("75 min")).toBeVisible();
    fireEvent.click(screen.getAllByRole("button", { name: "Ajouter 5 minutes" })[0]);
    expect(screen.getByText("80 min")).toBeVisible();
    fireEvent.click(screen.getAllByRole("button", { name: "Remplacer la situation" })[2]);
    fireEvent.click(screen.getByRole("button", { name: "Valider cette séance" }));

    expect(screen.getByRole("status")).toHaveTextContent("Séance prête");
  });
});
