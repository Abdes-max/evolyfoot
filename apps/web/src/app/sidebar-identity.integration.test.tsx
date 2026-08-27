import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarIdentity } from "./sidebar-identity";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe("SidebarIdentity", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("propose de se connecter quand personne n’est authentifié", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ educator: null }));

    render(<SidebarIdentity />);

    expect(await screen.findByText("Non connecté")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /se connecter/i })[0]).toHaveAttribute("href", "/connexion");
  });

  it("affiche l’éducateur connecté et son équipe", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/auth/session")) {
        return jsonResponse({ educator: { id: "1", email: "coach@example.test", displayName: "Coach Test" } });
      }
      return jsonResponse({ profile: { name: "FC Horizon", ageGroup: "U12", playerCount: 14 } });
    });

    render(<SidebarIdentity />);

    expect(await screen.findByText("Coach Test")).toBeInTheDocument();
    expect(screen.getByText("FC Horizon · U12")).toBeInTheDocument();
    expect(screen.getByText("14 joueurs")).toBeInTheDocument();
    expect(screen.getByText("CT")).toBeInTheDocument();
  });

  it("invite à configurer l’équipe quand l’éducateur n’en a pas encore", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/auth/session")) {
        return jsonResponse({ educator: { id: "1", email: "coach@example.test", displayName: "Coach Test" } });
      }
      return jsonResponse({ profile: null });
    });

    render(<SidebarIdentity />);

    expect(await screen.findByText("Pas encore d’équipe")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /configurer mon équipe/i })).toHaveAttribute("href", "/onboarding");
  });

  it("se déconnecte puis quitte le tableau de bord", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/auth/logout")) {
        return jsonResponse({ status: "ok" });
      }
      if (url.includes("/api/auth/session")) {
        return jsonResponse({ educator: { id: "1", email: "coach@example.test", displayName: "Coach Test" } });
      }
      return jsonResponse({ profile: null });
    });
    const originalLocation = window.location;
    Object.defineProperty(window, "location", { value: { ...originalLocation, href: "" }, writable: true });

    render(<SidebarIdentity />);
    fireEvent.click(await screen.findByRole("button", { name: /se déconnecter/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" }));
    await waitFor(() => expect(window.location.href).toBe("/connexion"));

    Object.defineProperty(window, "location", { value: originalLocation, writable: true });
  });
});
