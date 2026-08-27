import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ExercisePage from "./page";

describe("détail d’un exercice", () => {
  it("affiche le but du jeu, les règles numérotées et les points de coaching", async () => {
    render(await ExercisePage({ params: Promise.resolve({ id: "welcome-recuperer" }) }));

    expect(screen.getByRole("heading", { name: "Accueil chasse au ballon" })).toBeVisible();
    expect(screen.getByText("Déclencher une réaction immédiate à la perte.")).toBeVisible();
    expect(screen.getByText("01")).toBeVisible();
    expect(screen.getByText(/Rondo 4 contre 1 dans chaque carré/)).toBeVisible();
    expect(screen.getByText("Réagir à la perte dans les deux secondes.")).toBeVisible();
    expect(screen.getByText("16 / 20")).toBeVisible();
  });

  it("permet de donner un avis sur l’exercice", async () => {
    render(await ExercisePage({ params: Promise.resolve({ id: "welcome-recuperer" }) }));

    const like = screen.getByRole("button", { name: "Cet exercice m’a plu" });
    fireEvent.click(like);

    expect(like).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Merci, c’est noté.");
  });

  it("navigue vers l’exercice suivant du même thème", async () => {
    render(await ExercisePage({ params: Promise.resolve({ id: "welcome-recuperer" }) }));

    expect(screen.getByRole("link", { name: /duel et contre-pression/i })).toHaveAttribute(
      "href",
      "/bibliotheque/activation-recuperer",
    );
  });
});
