import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FieldModeView } from "./field-mode-view";

const record = {
  id: "s-1",
  title: "Séance 3 · Créer et utiliser les espaces",
  ageGroup: "U11",
  playerCount: 16,
  theme: "Conserver le ballon",
  intention: "Créer et utiliser les espaces",
  weekNumber: 9,
  slot: 0,
  cycleNumber: 0,
  blocks: [
    { id: "b1", activityId: "cfi-espaces-jonglage", durationMinutes: 10 },
    { id: "b2", activityId: "cfi-espaces-match", durationMinutes: 15 },
  ],
};

describe("mode terrain", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("chronomètre la séquence, compte les points et passe à la suite", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => (url === "/api/sessions/s-1" ? Response.json({ session: record }) : Response.json({ exercises: [] }))),
    );
    render(<FieldModeView sessionId="s-1" />);

    expect(await screen.findByRole("heading", { name: "Jongler à deux" })).toBeVisible();
    expect(screen.getByText("Séquence 1/4")).toBeVisible();
    expect(screen.getByText("2:00")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Ajouter un point à Équipe A" }));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Démarrer" }));
    act(() => {
      vi.advanceTimersByTime(120_000);
    });

    expect(screen.getByText("Séquence terminée")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Séquence suivante" }));
    expect(screen.getByText("Séquence 2/4")).toBeVisible();
    expect(screen.getByRole("button", { name: "Pause" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Situation suivante →" }));
    expect(screen.getByRole("heading", { name: "Match : deux touches au centre" })).toBeVisible();
    expect(screen.getByText("Séquence 1/2")).toBeVisible();
    expect(screen.getAllByText("0")).toHaveLength(2);
  });

  it("indique une séance introuvable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 404 })),
    );
    render(<FieldModeView sessionId="inconnue" />);

    expect(await screen.findByText("Cette séance est introuvable.")).toBeVisible();
  });
});
