import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PlanPage from "./page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/plan" }));

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe("development plan", () => {
  it("présente quatre semaines et leur raison", () => {
    render(<PlanPage />);

    expect(screen.getAllByText(/^S[1-4]$/)).toHaveLength(4);
    expect(screen.getByText(/comportement le plus fragile/i)).toBeVisible();
    expect(screen.getByRole("link", { name: "Préparer la première séance" })).toHaveAttribute("href", "/session");
  });

  describe("avec un éducateur connecté", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("propose le cycle suivant quand toutes les séances sont prêtes", async () => {
      vi.mocked(fetch).mockImplementation(async (input) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        if (url.includes("/api/auth/session")) {
          return jsonResponse({ educator: { id: "1", email: "coach@example.test", displayName: "Coach" } });
        }
        if (url.includes("/api/sessions")) {
          return jsonResponse({ cycleNumber: 2, sessions: [1, 2, 3, 4].map((weekNumber) => ({ weekNumber, slot: 0 })) });
        }
        if (url.includes("/api/team")) {
          return jsonResponse({ profile: { trainingDays: ["Mardi"] } });
        }
        return jsonResponse({ scores: null });
      });

      render(<PlanPage />);

      expect(await screen.findByRole("button", { name: /démarrer le cycle suivant/i })).toBeVisible();
      expect(screen.getByRole("heading", { name: "Ton cycle 2 est prêt." })).toBeVisible();
    });

    it("construit le cycle à partir du diagnostic réel plutôt que de la démonstration", async () => {
      vi.mocked(fetch).mockImplementation(async (input) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        if (url.includes("/api/auth/session")) {
          return jsonResponse({ educator: { id: "1", email: "coach@example.test", displayName: "Coach" } });
        }
        return jsonResponse({ scores: { availability: 1, scanning: 3, progression: 4, reactionAfterLoss: 4 } });
      });

      render(<PlanPage />);

      expect(await screen.findByRole("heading", { name: "Cycle · Se rendre disponible" })).toBeInTheDocument();
    });
  });
});
