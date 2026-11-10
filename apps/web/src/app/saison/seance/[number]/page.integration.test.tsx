import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ProgramSessionPage from "./page";

describe("fiche d’une séance de la saison", () => {
  it("détaille les six situations d’une séance à thème avec leur schéma", async () => {
    render(await ProgramSessionPage({ params: Promise.resolve({ number: "3" }) }));

    expect(screen.getByRole("heading", { level: 1, name: "Créer et utiliser les espaces" })).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Voir la fiche complète" })).toHaveLength(6);
    expect(screen.getByRole("heading", { name: "Jongler à deux" })).toBeVisible();
  });

  it("donne le protocole d’une évaluation", async () => {
    render(await ProgramSessionPage({ params: Promise.resolve({ number: "2" }) }));

    expect(screen.getByRole("heading", { level: 1, name: "Évaluation collective · défense" })).toBeVisible();
    expect(screen.getByText("Ballons récupérés")).toBeVisible();
  });

  it("permet de changer un exercice avant de préparer la séance", async () => {
    render(await ProgramSessionPage({ params: Promise.resolve({ number: "3" }) }));

    fireEvent.change(screen.getByRole("combobox", { name: "Changer l’exercice 1" }), { target: { value: "activation-conserver" } });

    expect(screen.getByRole("heading", { name: "Rondo mobile 4 contre 1" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("1 exercice changé");
    fireEvent.click(screen.getByRole("button", { name: "Remettre l’exercice du programme" }));
    expect(screen.getByRole("heading", { name: "Jongler à deux" })).toBeVisible();
    expect(within(document.body).queryByRole("status")).toBeNull();
  });
});
