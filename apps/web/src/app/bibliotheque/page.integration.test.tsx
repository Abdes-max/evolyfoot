import { trainingActivityCatalogue } from "@evolyfoot/domain";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BibliothequePage from "./page";

describe("bibliothèque", () => {
  it("liste les vingt situations d’entraînement avec un lien vers chaque détail", () => {
    render(<BibliothequePage />);

    expect(screen.getAllByRole("link").filter((link) => link.getAttribute("href")?.startsWith("/bibliotheque/"))).toHaveLength(
      trainingActivityCatalogue.length,
    );
    expect(screen.getByRole("heading", { name: "Rondo mobile 4 contre 1" })).toBeVisible();
  });

  it("filtre par type de bloc", () => {
    render(<BibliothequePage />);

    fireEvent.click(screen.getByRole("button", { name: "Jeu" }));

    const gameCount = trainingActivityCatalogue.filter((activity) => activity.kind === "game").length;
    expect(screen.getAllByRole("link").filter((link) => link.getAttribute("href")?.startsWith("/bibliotheque/"))).toHaveLength(gameCount);
    expect(screen.queryByRole("heading", { name: "Rondo mobile 4 contre 1" })).not.toBeInTheDocument();
  });

  it("recherche par titre et affiche un état vide sans résultat", () => {
    render(<BibliothequePage />);

    const search = screen.getByRole("searchbox", { name: /rechercher une situation/i });
    fireEvent.change(search, { target: { value: "récupérer en cinq secondes" } });

    expect(screen.getByRole("heading", { name: "Récupérer en cinq secondes" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Rondo mobile 4 contre 1" })).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "aucune situation ne portera ce nom" } });
    expect(screen.getByText("Aucune situation ne correspond à ta recherche.")).toBeVisible();
  });
});
