import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DiagnosticPage from "./page";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

function submitDiagnostic() {
  fireEvent.click(screen.getByRole("button", { name: "Réagir après la perte : Rarement" }));
  fireEvent.click(screen.getByRole("button", { name: /voir mes priorités/i }));
}

describe("initial diagnostic", () => {
  it("explique les deux priorités au coach", () => {
    render(<DiagnosticPage />);
    submitDiagnostic();
    expect(screen.getByRole("status")).toHaveTextContent("Réagir après la perte");
    expect(screen.getByRole("status")).toHaveTextContent("Récupérer rapidement");
  });

  describe("avec un éducateur connecté", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("sauvegarde le diagnostic pour un éducateur connecté", async () => {
      vi.mocked(fetch).mockImplementation(async (input, init) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        if (url.includes("/api/auth/session")) {
          return jsonResponse({ educator: { id: "1", email: "coach@example.test", displayName: "Coach" } });
        }
        if (url.includes("/api/diagnostic") && init?.method === "PUT") {
          return jsonResponse({ scores: JSON.parse(String(init.body)) });
        }
        return jsonResponse({ scores: null });
      });

      render(<DiagnosticPage />);
      await screen.findByText("Où en est ton équipe aujourd’hui ?");
      submitDiagnostic();

      expect(screen.getByRole("status")).toHaveTextContent("Réagir après la perte");
      await vi.waitFor(() =>
        expect(fetch).toHaveBeenCalledWith(
          "/api/diagnostic",
          expect.objectContaining({ method: "PUT" }),
        ),
      );
      expect(screen.queryByText(/connecte-toi pour sauvegarder/i)).not.toBeInTheDocument();
    });

    it("invite à se connecter plutôt que de prétendre sauvegarder sans compte", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ educator: null }));

      render(<DiagnosticPage />);
      await screen.findByText("Où en est ton équipe aujourd’hui ?");
      submitDiagnostic();

      expect(await screen.findByText(/connecte-toi pour sauvegarder ce diagnostic/i)).toBeInTheDocument();
    });
  });
});
