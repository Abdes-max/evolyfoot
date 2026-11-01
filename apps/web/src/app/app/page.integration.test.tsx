import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

function mockApi(overrides: Record<string, unknown>) {
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    const path = new URL(url, "http://localhost").pathname;
    if (path === "/api/auth/session") {
      return jsonResponse({ educator: { id: "1", email: "coach@example.test", displayName: "Camille Martin" } });
    }
    return jsonResponse(overrides[path] ?? {});
  });
}

describe("tableau de bord", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("guide un nouvel éducateur plutôt que d'afficher du contenu de démonstration", async () => {
    mockApi({});

    render(<Home />);

    expect(await screen.findByRole("heading", { name: "Bonjour Camille," })).toBeVisible();
    expect(screen.getByRole("link", { name: /crée ton équipe/i })).toHaveAttribute("href", "/onboarding");
    expect(screen.getByText(/aucune observation pour l’instant/i)).toBeVisible();
    expect(screen.queryByText("Jouer, bouger, proposer")).not.toBeInTheDocument();
  });

  it("relie la priorité du cycle réel à la prochaine séance enregistrée", async () => {
    const meetingAt = new Date(Date.now() + 86_400_000).toISOString();
    mockApi({
      "/api/team": { profile: { name: "FC Horizon", trainingDays: ["Mardi", "Jeudi"] } },
      "/api/diagnostic": { scores: { availability: 3, scanning: 3, progression: 3, reactionAfterLoss: 1 } },
      "/api/sessions": {
        sessions: [
          { id: "s1", weekNumber: 1, slot: 0, title: "Réagir ensemble", theme: "Récupérer rapidement", playerCount: 12, blocks: [{ durationMinutes: 75 }], meetingAt },
        ],
      },
      "/api/observations": {
        observations: [
          {
            id: "o1",
            title: "Séance du mardi",
            ratings: [
              { criterion: "availability", level: "achieved", score: 100 },
              { criterion: "scanning", level: "progress", score: 50 },
              { criterion: "progression", level: "progress", score: 50 },
              { criterion: "reactionAfterLoss", level: "reinforce", score: 0 },
            ],
          },
        ],
      },
    });

    render(<Home />);

    expect(await screen.findByRole("link", { name: "Ouvrir la séance : Réagir ensemble" })).toHaveAttribute("href", "/session/s1");
    expect(screen.getByText("1/8 séances préparées")).toBeVisible();
    expect(screen.getByRole("link", { name: "Voir l’observation" })).toHaveAttribute("href", "/observations/o1");
  });
});
