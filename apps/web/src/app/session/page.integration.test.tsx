import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SessionPage from "./page";

describe("session builder", () => {
  it("recalcule la durée et valide une séance modifiée", () => {
    render(<SessionPage />);

    expect(screen.getByLabelText("Durée totale : 75 minutes")).toHaveAttribute("aria-live", "polite");
    fireEvent.click(screen.getAllByRole("button", { name: "Ajouter 5 minutes" })[0]);
    expect(screen.getByText("80 min")).toBeVisible();
    fireEvent.click(screen.getAllByRole("button", { name: "Remplacer la situation" })[2]);
    fireEvent.click(screen.getByRole("button", { name: "Valider cette séance" }));

    expect(screen.getByRole("status")).toHaveTextContent("Séance prête");
  });

  it("affiche les informations pratiques de chaque situation et l’effectif", () => {
    render(<SessionPage />);

    expect(screen.getByText("14 joueurs")).toBeVisible();
    expect(screen.getAllByText("Organisation")).toHaveLength(4);
    expect(screen.getAllByText("Consigne")).toHaveLength(4);
    expect(screen.getAllByText("À observer")).toHaveLength(4);
    expect(screen.getByText("Accueil", { exact: true })).toBeVisible();
    expect(screen.getByText("Situation principale", { exact: true })).toBeVisible();
    expect(screen.getByText("Jeu 5 contre 5 avec deux zones de marque.")).toBeVisible();
  });

  it("explique pourquoi une situation sans alternative ne peut pas être remplacée", () => {
    render(<SessionPage />);

    const replaceButtons = screen.getAllByRole("button", { name: /remplacer la situation/i });
    expect(replaceButtons[0]).toBeDisabled();
    expect(replaceButtons[0]).toHaveAccessibleDescription("Aucune autre situation compatible pour ce bloc.");
    expect(replaceButtons[2]).toBeEnabled();
  });

  it("conserve le focus sur le contrôle du même bloc après un déplacement", () => {
    render(<SessionPage />);
    const activationCard = screen.getByRole("heading", { name: "Duel et contre-pression" }).closest("li");
    expect(activationCard).not.toBeNull();
    const moveUp = within(activationCard!).getByRole("button", { name: "Monter" });

    moveUp.focus();
    fireEvent.click(moveUp);

    expect(moveUp).toHaveFocus();
    expect(screen.getAllByRole("listitem")[0]).toBe(activationCard);
  });
});
