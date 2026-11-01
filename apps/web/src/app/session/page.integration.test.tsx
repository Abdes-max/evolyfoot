import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionView } from "./session-view";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe("session builder", () => {
  it("recalcule la durée d’une séance modifiée", () => {
    render(<SessionView slot={0} weekNumber={1} />);

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

      render(<SessionView slot={0} weekNumber={1} />);
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/diagnostic"));
      fireEvent.change(screen.getByLabelText("Rendez-vous (date et heure)"), { target: { value: "2026-09-15T18:00" } });
      fireEvent.click(screen.getByRole("button", { name: "Valider cette séance" }));

      await vi.waitFor(() =>
        expect(fetch).toHaveBeenCalledWith("/api/sessions", expect.objectContaining({ method: "POST" })),
      );
      expect(await screen.findByRole("status")).toHaveTextContent("Séance prête");
      expect(screen.queryByText(/connecte-toi pour enregistrer/i)).not.toBeInTheDocument();
    });

    it("invite à se connecter plutôt que de prétendre sauvegarder sans compte", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ educator: null }));

      render(<SessionView slot={0} weekNumber={1} />);
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/auth/session"));
      fireEvent.change(screen.getByLabelText("Rendez-vous (date et heure)"), { target: { value: "2026-09-15T18:00" } });
      fireEvent.click(screen.getByRole("button", { name: "Valider cette séance" }));

      expect(await screen.findByText(/connecte-toi pour enregistrer cette séance/i)).toBeInTheDocument();
    });
  });

  it("résume chaque temps dans une liste, sans le détail de l'exercice", () => {
    render(<SessionView slot={0} weekNumber={1} />);

    expect(screen.getByText("14 joueurs")).toBeVisible();
    expect(screen.getByText("Accueil", { exact: true })).toBeVisible();
    expect(screen.getByText("Situation principale", { exact: true })).toBeVisible();
    expect(screen.queryByText("Organisation")).not.toBeInTheDocument();
  });

  it("ouvre la fiche d'un exercice et passe au suivant", () => {
    render(<SessionView slot={0} weekNumber={1} />);

    fireEvent.click(screen.getByRole("button", { name: "Récupérer en cinq secondes" }));

    expect(screen.getByText("Exercice 3 sur 4")).toBeVisible();
    expect(screen.getByText("Organisation")).toBeVisible();
    expect(screen.getByText("Jeu 5 contre 5 avec deux zones de marque.")).toBeVisible();
    expect(screen.getByRole("link", { name: /voir dans la bibliothèque/i })).toHaveAttribute("href", expect.stringContaining("/bibliotheque/main-"));

    fireEvent.click(screen.getByRole("button", { name: "Exercice suivant" }));
    expect(screen.getByText("Exercice 4 sur 4")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "← Toute la séance" }));
    expect(screen.getByRole("list", { name: "Les temps de la séance" })).toBeVisible();
  });

  it("met toutes les fiches dans l'export PDF", () => {
    const print = vi.fn(() => expect(screen.getAllByText("Organisation")).toHaveLength(4));
    vi.stubGlobal("print", print);
    window.print = print;
    render(<SessionView slot={0} weekNumber={1} />);

    fireEvent.click(screen.getByRole("button", { name: "Exporter en PDF" }));

    expect(print).toHaveBeenCalledOnce();
    expect(screen.queryByText("Organisation")).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("permet de remplacer chaque situation de la séance", () => {
    render(<SessionView slot={0} weekNumber={1} />);

    for (const button of screen.getAllByRole("button", { name: /remplacer la situation/i })) {
      expect(button).toBeEnabled();
    }
  });

  it("affiche le schéma tactique de chaque situation", () => {
    render(<SessionView slot={0} weekNumber={1} />);

    expect(screen.getAllByRole("img", { name: /schéma tactique/i })).toHaveLength(4);
  });

  it("conserve le focus sur le contrôle du même bloc après un déplacement", () => {
    render(<SessionView slot={0} weekNumber={1} />);
    const activationCard = screen.getByRole("heading", { name: "Duel et contre-pression" }).closest("li");
    expect(activationCard).not.toBeNull();
    const moveUp = within(activationCard!).getByRole("button", { name: "Monter" });

    moveUp.focus();
    fireEvent.click(moveUp);

    expect(moveUp).toHaveFocus();
    expect(screen.getAllByRole("listitem")[0]).toBe(activationCard);
  });
});
