import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EquipePage from "./page";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

const team = { name: "FC Horizon", ageGroup: "U12", gameFormat: 8, playerCount: 14 };

describe("roster", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("invite à se connecter plutôt que d’afficher un formulaire sans compte", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ educator: null }));

    render(<EquipePage />);

    expect(await screen.findByText(/connecte-toi pour gérer l’effectif/i)).toBeInTheDocument();
  });

  it("liste l’effectif réel d’un éducateur connecté", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/auth/session")) {
        return jsonResponse({ educator: { id: "1", email: "coach@example.test", displayName: "Coach" } });
      }
      if (url.includes("/api/team")) {
        return jsonResponse({ profile: team });
      }
      if (url.includes("/api/roster")) {
        return jsonResponse({ players: [{ id: "player-1", name: "Kylian" }] });
      }
      return jsonResponse({});
    });

    render(<EquipePage />);

    expect(await screen.findByText("Kylian")).toBeInTheDocument();
    expect(screen.getByText(/foot à 8/i)).toBeInTheDocument();
  });

  it("ajoute un joueur", async () => {
    let players: Array<{ id: string; name: string }> = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/auth/session")) {
        return jsonResponse({ educator: { id: "1", email: "coach@example.test", displayName: "Coach" } });
      }
      if (url.includes("/api/team")) {
        return jsonResponse({ profile: team });
      }
      if (url.endsWith("/api/roster") && init?.method === "POST") {
        const player = { id: "player-2", name: JSON.parse(String(init.body)).name };
        players = [...players, player];
        return new Response(JSON.stringify({ player }), { status: 201 });
      }
      if (url.endsWith("/api/roster")) {
        return jsonResponse({ players });
      }
      return jsonResponse({});
    });

    render(<EquipePage />);
    await screen.findByLabelText("Ajouter un joueur");

    fireEvent.change(screen.getByLabelText("Ajouter un joueur"), { target: { value: "Ousmane" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));

    expect(await screen.findByText("Ousmane")).toBeInTheDocument();
  });

  it("retire un joueur", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/auth/session")) {
        return jsonResponse({ educator: { id: "1", email: "coach@example.test", displayName: "Coach" } });
      }
      if (url.includes("/api/team")) {
        return jsonResponse({ profile: team });
      }
      if (url.match(/\/api\/roster\/player-1$/)) {
        return jsonResponse({ status: "ok" });
      }
      if (url.endsWith("/api/roster")) {
        return jsonResponse({ players: [{ id: "player-1", name: "Kylian" }] });
      }
      return jsonResponse({});
    });

    render(<EquipePage />);
    const retirer = await screen.findByRole("button", { name: "Retirer Kylian" });
    fireEvent.click(retirer);

    await waitFor(() => expect(screen.queryByText("Kylian")).not.toBeInTheDocument());
  });
});
