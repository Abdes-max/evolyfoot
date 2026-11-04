import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ProgramSessionPage from "./page";

describe("fiche d’une séance de la saison", () => {
  it("détaille les six situations d’une séance à thème avec leur schéma", async () => {
    render(await ProgramSessionPage({ params: Promise.resolve({ number: "3" }) }));

    expect(screen.getByRole("heading", { level: 1, name: "Créer et utiliser les espaces" })).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Voir l’animation et les points clés" })).toHaveLength(6);
    expect(screen.getByRole("heading", { name: "Jongler à deux" })).toBeVisible();
  });

  it("donne le protocole d’une évaluation", async () => {
    render(await ProgramSessionPage({ params: Promise.resolve({ number: "2" }) }));

    expect(screen.getByRole("heading", { level: 1, name: "Évaluation collective · défense" })).toBeVisible();
    expect(screen.getByText("Ballons récupérés")).toBeVisible();
  });
});
