import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ConnexionPage from "./page";

describe("connexion", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("connecte l’éducateur et affiche le lien vers le tableau de bord", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ educator: { id: "1" } }), { status: 200 }));
    render(<ConnexionPage />);

    fireEvent.change(screen.getByLabelText("Adresse e-mail"), { target: { value: "coach@example.test" } });
    fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: "motdepasse1" } });
    fireEvent.click(screen.getByRole("button", { name: /se connecter/i }));

    expect(await screen.findByRole("status")).toHaveTextContent("Connexion réussie");
    expect(screen.getByRole("link", { name: /aller au tableau de bord/i })).toHaveAttribute("href", "/");
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("affiche l’erreur renvoyée par l’API en cas d’échec", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Adresse e-mail ou mot de passe incorrect." }), { status: 401 }),
    );
    render(<ConnexionPage />);

    fireEvent.change(screen.getByLabelText("Adresse e-mail"), { target: { value: "coach@example.test" } });
    fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: "mauvaispasse" } });
    fireEvent.click(screen.getByRole("button", { name: /se connecter/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Adresse e-mail ou mot de passe incorrect.");
  });

  it("propose de créer un compte", () => {
    render(<ConnexionPage />);

    expect(screen.getByRole("link", { name: /créer un compte/i })).toHaveAttribute("href", "/inscription");
  });
});
