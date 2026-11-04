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

  it("affiche l’éducateur connecté, son équipe et l’effectif nominatif réel", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/auth/session")) {
        return jsonResponse({ educator: { id: "1", email: "coach@example.test", displayName: "Coach Test" } });
      }
      if (url.includes("/api/roster")) {
        // Le nombre affiché doit venir de l'effectif nominatif réel, pas de Team.playerCount
        // (un chiffre saisi une fois à l'onboarding, désynchronisé dès qu'un joueur est
        // ajouté/retiré) -- volontairement différent des 14 de Team.playerCount ci-dessous pour
        // vérifier que ce dernier n'est plus utilisé.
        return jsonResponse({
          players: [
            { id: "p1", name: "Kylian" },
            { id: "p2", name: "Léo" },
          ],
        });
      }
      return jsonResponse({ profile: { name: "FC Horizon", ageGroup: "U12", gameFormat: 8, playerCount: 14 } });
    });

    render(<SidebarIdentity />);

    expect(await screen.findByText("Coach Test")).toBeInTheDocument();
    expect(screen.getByText("FC Horizon · U12")).toBeInTheDocument();
    expect(screen.getByText("Foot à 8 · 2 joueurs")).toBeInTheDocument();
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

  it("n’annonce le nouveau lien de confirmation qu’une fois l’envoi accepté, sinon propose de réessayer", async () => {
    let resendStatus = 500;
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/auth/resend-verification")) {
        return new Response(JSON.stringify({}), { status: resendStatus });
      }
      if (url.includes("/api/auth/session")) {
        return jsonResponse({ educator: { id: "1", email: "coach@example.test", displayName: "Coach Test", emailVerified: false } });
      }
      return jsonResponse({ profile: null });
    });

    render(<SidebarIdentity />);
    fireEvent.click(await screen.findByRole("button", { name: "Renvoyer le lien" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Le lien n’a pas pu être envoyé.");
    expect(screen.queryByText("Nouveau lien envoyé.")).not.toBeInTheDocument();

    resendStatus = 200;
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(await screen.findByText("Nouveau lien envoyé.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("propose à l’éducateur de changer d’équipe ou d’en ajouter une", async () => {
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/auth/session")) {
        return jsonResponse({ educator: { id: "1", email: "coach@example.test", displayName: "Coach Test" }, role: "coach" });
      }
      if (url.includes("/api/teams/active")) {
        return jsonResponse({ status: "ok" });
      }
      if (url.includes("/api/teams")) {
        return init?.method === "POST"
          ? jsonResponse({ id: "3" })
          : jsonResponse({
              teams: [
                { id: "1", name: "FC Horizon", ageGroup: "U12", primary: true, active: true },
                { id: "2", name: null, ageGroup: null, primary: false, active: false },
              ],
            });
      }
      if (url.includes("/api/roster")) {
        return jsonResponse({ players: [] });
      }
      return jsonResponse({ profile: { name: "FC Horizon", ageGroup: "U12", gameFormat: 8, playerCount: 14 } });
    });
    const originalLocation = window.location;
    Object.defineProperty(window, "location", { value: { ...originalLocation, href: "" }, writable: true });

    render(<SidebarIdentity />);
    const select = await screen.findByRole("combobox", { name: "Changer d’équipe" });
    expect(screen.getByRole("option", { name: "Nouvelle équipe (à configurer)" })).toBeInTheDocument();

    fireEvent.change(select, { target: { value: "2" } });
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/teams/active", expect.objectContaining({ method: "PUT", body: JSON.stringify({ id: "2" }) })));
    await waitFor(() => expect(window.location.href).toBe(`${originalLocation.origin}/app`));

    fireEvent.change(select, { target: { value: "nouvelle-equipe" } });
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/teams", { method: "POST" }));
    await waitFor(() => expect(window.location.href).toBe(`${originalLocation.origin}/onboarding`));

    Object.defineProperty(window, "location", { value: originalLocation, writable: true });
  });

  it("ne montre pas de choix d’équipe à un adjoint", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/auth/session")) {
        return jsonResponse({ educator: { id: "9", email: "adjoint@example.test", displayName: "Adjoint" }, role: "assistant" });
      }
      return jsonResponse({ profile: { name: "FC Horizon", ageGroup: "U12", gameFormat: 8, playerCount: 14 } });
    });

    render(<SidebarIdentity />);

    expect(await screen.findByText("FC Horizon · U12")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Changer d’équipe" })).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith("/api/teams");
  });
});
