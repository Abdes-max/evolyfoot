import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuidedSeason } from "./guided-season";

function mockApi(program: unknown, sessions: unknown[] = []) {
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
      if (url === "/api/sessions?scope=season") return Response.json({ sessions });
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

    expect(await screen.findByText("Semaine 1 sur 36 · cette semaine")).toBeVisible();
    const put = calls.find((call) => call.init?.method === "PUT");
    expect(JSON.parse(put!.init!.body as string).priorities).toEqual(["Récupérer rapidement", "Progresser ensemble"]);
    expect(screen.queryByText("Plan par cycles")).toBeNull();
  });

  it("affiche la semaine en cours et la grille d’une saison déjà lancée", async () => {
    mockApi({ priorities: ["Protéger son but"], startDate: "2026-09-07" });
    render(<GuidedSeason now={new Date(2026, 10, 4)} />);

    expect(await screen.findByText("Semaine 9 sur 36 · cette semaine")).toBeVisible();
    await waitFor(() => expect(screen.getAllByRole("link", { name: /^Semaine \d+, séance/ })).toHaveLength(72));
    expect(screen.getByText(/Protéger son but \(prioritaire\) · \d+/)).toBeVisible();
  });

  it("parcourt les semaines et marque les séances déjà préparées", async () => {
    mockApi({ priorities: ["Protéger son but"], startDate: "2026-09-07" }, [
      { id: "s-1", cycleNumber: 0, weekNumber: 10, slot: 1, meetingAt: "2026-11-12T17:00:00.000Z", location: "Stade municipal" },
      { id: "s-2", cycleNumber: 1, weekNumber: 10, slot: 0, meetingAt: null, location: null },
    ]);
    render(<GuidedSeason now={new Date(2026, 10, 4)} />);

    expect(await screen.findByText("Semaine 9 sur 36 · cette semaine")).toBeVisible();
    expect(screen.getByText("1 séance préparée sur 72")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Semaine suivante" }));
    expect(screen.getByText("Semaine 10 sur 36")).toBeVisible();
    expect(screen.getByText(/Préparée · .*Stade municipal/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Mode terrain" })).toHaveAttribute("href", "/session/s-1/terrain");
    expect(screen.getByRole("link", { name: /^Semaine 10, séance 2 : .* \(préparée\)$/ })).toHaveAttribute("href", "/session/s-1");
    expect(screen.getByRole("link", { name: /^Semaine 10, séance 1 : [^(]*$/ })).toHaveAttribute("href", expect.stringContaining("semaine=10&creneau=0"));

    fireEvent.click(screen.getByRole("button", { name: "Revenir à cette semaine" }));
    expect(screen.getByText("Semaine 9 sur 36 · cette semaine")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Voir la semaine 36" }));
    expect(screen.getByText("Semaine 36 sur 36")).toBeVisible();
    expect(screen.getByRole("button", { name: "Semaine suivante" })).toBeDisabled();
  });
});
