import { diagnosticCriteria } from "@evolyfoot/domain";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ObservationPage from "./page";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

function completeObservationForm() {
  fireEvent.click(screen.getByRole("button", { name: "Après un match" }));
  for (const criterion of diagnosticCriteria) {
    fireEvent.click(screen.getByRole("button", { name: `${criterion.label} : En progrès` }));
  }
}

describe("quick observation", () => {
  it("initializes a match observation from Next search parameters", async () => {
    render(await ObservationPage({ searchParams: Promise.resolve({ type: "match" }) }));

    expect(screen.getByRole("button", { name: "Après un match" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Après un match" })).toHaveTextContent("Sélectionné");
  });

  it("completes an observation with visible selected states and an optional player signal", async () => {
    render(await ObservationPage({}));

    const submit = screen.getByRole("button", { name: /valider l’observation/i });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Après un match" }));
    for (const criterion of diagnosticCriteria) {
      const level = screen.getByRole("button", { name: `${criterion.label} : En progrès` });
      expect(level).toHaveAttribute("aria-pressed", "false");
      fireEvent.click(level);
      expect(level).toHaveAttribute("aria-pressed", "true");
      expect(level).toHaveTextContent("Sélectionné");
    }

    const highlightLina = screen.getByRole("button", { name: /mettre Lina en réussite à retenir/i });
    fireEvent.click(highlightLina);
    expect(highlightLina).toHaveAttribute("aria-pressed", "true");
    expect(highlightLina).toHaveTextContent("Sélectionné");
    fireEvent.click(highlightLina);
    expect(highlightLina).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(highlightLina);

    fireEvent.click(submit);

    expect(screen.getByRole("status")).toHaveTextContent("Tendance en progrès");
    expect(screen.getByRole("status")).toHaveTextContent("1 joueur signalé");
  });

  it("keeps spaces in a note while the coach is typing", async () => {
    render(await ObservationPage({}));

    const note = screen.getByRole("textbox", { name: /une note si elle aide/i });
    fireEvent.change(note, { target: { value: "  Belle largeur dans les temps  " } });

    expect(note).toHaveValue("  Belle largeur dans les temps  ");
  });

  describe("avec un éducateur connecté", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("sauvegarde l’observation validée pour un éducateur connecté", async () => {
      vi.mocked(fetch).mockImplementation(async (input, init) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        if (url.includes("/api/auth/session")) {
          return jsonResponse({ educator: { id: "1", email: "coach@example.test", displayName: "Coach" } });
        }
        if (url.includes("/api/diagnostic") && init?.method !== "PUT") {
          return jsonResponse({ scores: null });
        }
        if (url.includes("/api/observations") && init?.method === "POST") {
          return new Response(JSON.stringify({ report: JSON.parse(String(init.body)) }), { status: 201 });
        }
        return jsonResponse({});
      });

      render(await ObservationPage({}));
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/diagnostic"));
      completeObservationForm();
      fireEvent.click(screen.getByRole("button", { name: /valider l’observation/i }));

      await vi.waitFor(() =>
        expect(fetch).toHaveBeenCalledWith("/api/observations", expect.objectContaining({ method: "POST" })),
      );
      expect(screen.queryByText(/connecte-toi pour enregistrer/i)).not.toBeInTheDocument();
    });

    it("invite à se connecter plutôt que de prétendre sauvegarder sans compte", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ educator: null }));

      render(await ObservationPage({}));
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/auth/session"));
      completeObservationForm();
      fireEvent.click(screen.getByRole("button", { name: /valider l’observation/i }));

      expect(await screen.findByText(/connecte-toi pour enregistrer cette observation/i)).toBeInTheDocument();
    });
  });
});
