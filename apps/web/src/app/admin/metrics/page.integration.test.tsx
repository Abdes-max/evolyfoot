import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MetricsPage from "./page";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const metrics = {
  funnel: [
    { label: "Comptes créés", count: 10 },
    { label: "Équipe configurée", count: 8 },
    { label: "Diagnostic réalisé", count: 5 },
    { label: "Première séance validée", count: 3 },
    { label: "Première observation validée", count: 2 },
  ],
  weeklyActivity: [
    { weekStart: "2026-08-17", activeEducators: 1 },
    { weekStart: "2026-08-24", activeEducators: 3 },
  ],
  retention: { retainedFourWeeks: 1, activeLastFourWeeks: 3 },
  rosterAdoption: { educatorsWithPlayers: 2, totalEducators: 10 },
};

describe("admin metrics page", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("invite à se connecter pour un visiteur anonyme", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ educator: null }));

    render(<MetricsPage />);

    expect(await screen.findByText(/accès réservé/i)).toBeInTheDocument();
  });

  it("refuse l’accès à un éducateur connecté mais non autorisé", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/auth/session")) {
        return jsonResponse({ educator: { id: "1", email: "coach@example.test", displayName: "Coach" } });
      }
      return jsonResponse({ error: "Accès réservé." }, 403);
    });

    render(<MetricsPage />);

    expect(await screen.findByText(/accès réservé/i)).toBeInTheDocument();
  });

  it("affiche l’entonnoir et les indicateurs pour un administrateur", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/auth/session")) {
        return jsonResponse({ educator: { id: "1", email: "admin@example.test", displayName: "Admin" } });
      }
      return jsonResponse(metrics);
    });

    render(<MetricsPage />);

    expect(await screen.findByText("Comptes créés")).toBeInTheDocument();
    expect(screen.getByText("Première observation validée")).toBeInTheDocument();
    expect(screen.getAllByText("10").length).toBeGreaterThan(0);
    expect(screen.getByText(/rétention 4 semaines/i)).toBeInTheDocument();
  });
});
