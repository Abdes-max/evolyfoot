import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PrepareSeasonSession } from "./prepare-season-session";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("PrepareSeasonSession", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    push.mockReset();
  });

  it("préremplit date, heure et lieu puis prépare la séance", async () => {
    const posted: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "/api/season-program/sessions") {
          posted.push(JSON.parse(init!.body as string));
          return Response.json({ session: { id: "s-1" } }, { status: 201 });
        }
        if (url === "/api/season-program") return Response.json({ program: { priorities: ["Finir les actions"], startDate: "2026-09-07" } });
        if (url === "/api/team") return Response.json({ profile: { ageGroup: "U11", playerCount: 16, trainingDays: ["Mercredi"] } });
        if (url.startsWith("/api/places")) return Response.json({ places: [] });
        return Response.json({ sessions: [{ location: "Stade Jean-Bouin", createdAt: "2026-10-01T10:00:00.000Z" }] });
      }),
    );

    render(<PrepareSeasonSession sessionNumber={3} slot={0} week={2} />);

    await waitFor(() => expect(screen.getByLabelText("Date")).toHaveValue("2026-09-16"));
    expect(screen.getByLabelText("Heure")).toHaveValue("18:00");
    await waitFor(() => expect(screen.getByDisplayValue("Stade Jean-Bouin")).toBeVisible());

    fireEvent.click(screen.getByRole("button", { name: "Préparer cette séance" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/session/s-1"));
    expect(posted[0]).toMatchObject({ sessionNumber: 3, seasonWeek: 2, slot: 0, ageGroup: "U11", playerCount: 16, location: "Stade Jean-Bouin" });
  });

  it("demande le lieu avant de préparer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/team") return Response.json({ profile: { ageGroup: "U11", playerCount: 16, trainingDays: [] } });
        return Response.json({});
      }),
    );

    render(<PrepareSeasonSession sessionNumber={3} slot={0} week={1} />);
    await waitFor(() => expect(screen.getByLabelText("Date")).not.toHaveValue(""));
    fireEvent.click(screen.getByRole("button", { name: "Préparer cette séance" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Indique le lieu de la séance.");
  });
});
