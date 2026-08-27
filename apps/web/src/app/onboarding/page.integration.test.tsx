import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OnboardingPage from "./page";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

function fillTeam() {
  fireEvent.change(screen.getByLabelText("Nom de l’équipe"), { target: { value: "FC Horizon" } });
  fireEvent.click(screen.getByRole("button", { name: "Mar" }));
  fireEvent.click(screen.getByRole("button", { name: "Jeu" }));
  fireEvent.click(screen.getByRole("button", { name: /valider mon équipe/i }));
}

describe("team onboarding", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("enregistre l’équipe pour un éducateur connecté", async () => {
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/auth/session")) {
        return jsonResponse({ educator: { id: "1", email: "coach@example.test", displayName: "Coach" } });
      }
      if (url.includes("/api/team") && init?.method === "PUT") {
        return jsonResponse({ profile: JSON.parse(String(init.body)) });
      }
      return jsonResponse({ profile: null });
    });

    render(<OnboardingPage />);
    await screen.findByText("Ta saison en quelques repères");
    fillTeam();

    expect(await screen.findByRole("status")).toHaveTextContent("Équipe prête");
  });

  it("invite à se connecter plutôt que de prétendre enregistrer sans compte", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ educator: null }));

    render(<OnboardingPage />);
    await screen.findByText("Ta saison en quelques repères");
    fillTeam();

    expect(await screen.findByRole("alert")).toHaveTextContent("Connecte-toi pour enregistrer ton équipe.");
  });

  it("préremplit le formulaire avec l’équipe déjà enregistrée de l’éducateur", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/auth/session")) {
        return jsonResponse({ educator: { id: "1", email: "coach@example.test", displayName: "Coach" } });
      }
      return jsonResponse({
        profile: { name: "AS Rivière", ageGroup: "U13", playerCount: 16, sessionsPerWeek: 1, trainingDays: ["Mercredi"] },
      });
    });

    render(<OnboardingPage />);

    expect(await screen.findByDisplayValue("AS Rivière")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "U13", pressed: true })).toBeInTheDocument();
  });
});
