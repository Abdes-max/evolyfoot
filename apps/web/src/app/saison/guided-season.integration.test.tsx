import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuidedSeason } from "./guided-season";

function mockApi(program: unknown) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url === "/api/season-program" && init?.method === "PUT") {
        const { priorities } = JSON.parse(init.body as string);
        return Response.json({ program: { priorities, startDate: "2026-11-02" } });
      }
      if (url === "/api/season-program") return Response.json({ program });
      if (url === "/api/team") return Response.json({ profile: { sessionsPerWeek: 2 } });
      return Response.json({ scores: { availability: 3, scanning: 2, progression: 4, reactionAfterLoss: 1 } });
    }),
  );
  return calls;
}

describe("GuidedSeason", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("propose les priorités du diagnostic puis lance la saison en un clic", async () => {
    const calls = mockApi(null);
    render(<GuidedSeason fallback={<p>Plan par cycles</p>} now={new Date(2026, 10, 4)} />);

    const recover = await screen.findByRole("button", { name: "Récupérer rapidement" });
    expect(recover).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Plan par cycles")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Lancer ma saison" }));

    expect(await screen.findByText("Semaine 1 sur 36")).toBeVisible();
    const put = calls.find((call) => call.init?.method === "PUT");
    expect(JSON.parse(put!.init!.body as string).priorities).toEqual(["Récupérer rapidement", "Progresser ensemble"]);
    expect(screen.queryByText("Plan par cycles")).toBeNull();
  });

  it("affiche la semaine en cours et la grille d’une saison déjà lancée", async () => {
    mockApi({ priorities: ["Protéger son but"], startDate: "2026-09-07" });
    render(<GuidedSeason now={new Date(2026, 10, 4)} />);

    expect(await screen.findByText("Semaine 9 sur 36")).toBeVisible();
    await waitFor(() => expect(screen.getAllByRole("link", { name: /^Semaine \d+, séance/ })).toHaveLength(72));
    expect(screen.getByText("Protéger son but (prioritaire)")).toBeVisible();
  });
});
