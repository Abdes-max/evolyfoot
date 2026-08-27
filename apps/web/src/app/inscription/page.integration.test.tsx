import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InscriptionPage from "./page";

describe("inscription", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("crée le compte éducateur et affiche le lien vers l’onboarding", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ educator: { id: "1" } }), { status: 201 }));
    render(<InscriptionPage />);

    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Coach Test" } });
    fireEvent.change(screen.getByLabelText("Adresse e-mail"), { target: { value: "coach@example.test" } });
    fireEvent.change(screen.getByLabelText(/mot de passe/i), { target: { value: "motdepasse1" } });
    fireEvent.click(screen.getByRole("button", { name: /créer mon compte/i }));

    expect(await screen.findByRole("status")).toHaveTextContent("Compte créé");
    expect(screen.getByRole("link", { name: /configurer mon équipe/i })).toHaveAttribute("href", "/onboarding");
  });

  it("affiche l’erreur renvoyée par l’API quand l’e-mail est déjà utilisé", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Cette adresse e-mail est déjà utilisée." }), { status: 409 }),
    );
    render(<InscriptionPage />);

    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Coach Test" } });
    fireEvent.change(screen.getByLabelText("Adresse e-mail"), { target: { value: "coach@example.test" } });
    fireEvent.change(screen.getByLabelText(/mot de passe/i), { target: { value: "motdepasse1" } });
    fireEvent.click(screen.getByRole("button", { name: /créer mon compte/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Cette adresse e-mail est déjà utilisée.");
  });

  it("propose de se connecter pour un compte existant", () => {
    render(<InscriptionPage />);

    expect(screen.getByRole("link", { name: /se connecter/i })).toHaveAttribute("href", "/connexion");
  });
});
