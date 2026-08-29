import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SessionPage from "./page";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe("session builder", () => {
  it("recalcule la durée d’une séance modifiée", () => {
    render(<SessionPage />);

    expect(screen.getByLabelText("Durée totale : 75 minutes")).toHaveAttribute("aria-live", "polite");
    fireEvent.click(screen.getAllByRole("button", { name: "Ajouter 5 minutes" })[0]);
    expect(screen.getByText("80 min")).toBeVisible();
    fireEvent.click(screen.getAllByRole("button", { name: "Remplacer la situation" })[2]);
  });

  describe("avec un éducateur connecté", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("sauvegarde la séance validée pour un éducateur connecté", async () => {
      vi.mocked(fetch).mockImplementation(async (input, init) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        if (url.includes("/api/auth/session")) {
          return jsonResponse({ educator: { id: "1", email: "coach@example.test", displayName: "Coach" } });
        }
        if (url.includes("/api/team")) {
          return jsonResponse({ profile: null });
        }
        if (url.includes("/api/diagnostic")) {
          return jsonResponse({ scores: null });
        }
        if (url.includes("/api/sessions") && init?.method === "POST") {
          return new Response(JSON.stringify({ session: JSON.parse(String(init.body)) }), { status: 201 });
        }
        return jsonResponse({});
      });

      render(<SessionPage />);
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/diagnostic"));
      fireEvent.click(screen.getByRole("button", { name: "Valider cette séance" }));

      await vi.waitFor(() =>
        expect(fetch).toHaveBeenCalledWith("/api/sessions", expect.objectContaining({ method: "POST" })),
      );
      expect(await screen.findByRole("status")).toHaveTextContent("Séance prête");
      expect(screen.queryByText(/connecte-toi pour enregistrer/i)).not.toBeInTheDocument();
    });

    it("invite à se connecter plutôt que de prétendre sauvegarder sans compte", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ educator: null }));

      render(<SessionPage />);
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/auth/session"));
      fireEvent.click(screen.getByRole("button", { name: "Valider cette séance" }));

      expect(await screen.findByText(/connecte-toi pour enregistrer cette séance/i)).toBeInTheDocument();
    });
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

  it("affiche le schéma tactique de chaque situation avec un lien vers la bibliothèque", () => {
    render(<SessionPage />);

    expect(screen.getAllByRole("img", { name: /schéma tactique/i })).toHaveLength(4);
    const detailLinks = screen.getAllByRole("link", { name: /voir le détail/i });
    expect(detailLinks).toHaveLength(4);
    expect(detailLinks[0]).toHaveAttribute("href", "/bibliotheque/welcome-recuperer");
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
