import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ConnexionPage from "./page";

// LoginForm redirige vers le tableau de bord via useRouter().replace() -- ce hook lève hors d'un
// vrai contexte App Router (jamais présent ici, un simple render() de @testing-library/react),
// contrairement à usePathname() qui se contente de rendre null. Mocké une fois pour tout le
// fichier plutôt que par test : le routeur n'est jamais l'objet sous test ici, seul son appel
// compte.
const routerReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplace, push: vi.fn() }),
}));

describe("connexion", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    routerReplace.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockAuth(role: "coach" | "player") {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/auth/session")) {
        return new Response(JSON.stringify({ educator: role === "coach" ? { id: "1" } : null, role }), { status: 200 });
      }
      return new Response(JSON.stringify({ educator: { id: "1" } }), { status: 200 });
    });
  }

  it("connecte un coach et le redirige vers /app", async () => {
    mockAuth("coach");
    render(<ConnexionPage />);

    fireEvent.change(screen.getByLabelText("Adresse e-mail"), { target: { value: "coach@example.test" } });
    fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: "motdepasse1" } });
    fireEvent.click(screen.getByRole("button", { name: /se connecter/i }));

    expect(await screen.findByRole("status")).toHaveTextContent("Connexion réussie");
    await vi.waitFor(() => expect(routerReplace).toHaveBeenCalledWith("/app"));
    expect(fetch).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({ method: "POST" }));
  });

  it("connecte un compte joueur/tuteur et le redirige vers /joueur", async () => {
    mockAuth("player");
    render(<ConnexionPage />);

    fireEvent.change(screen.getByLabelText("Adresse e-mail"), { target: { value: "tuteur@example.test" } });
    fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: "motdepasse1" } });
    fireEvent.click(screen.getByRole("button", { name: /se connecter/i }));

    await vi.waitFor(() => expect(routerReplace).toHaveBeenCalledWith("/joueur"));
  });

  it("affiche l’erreur renvoyée par l’API en cas d’échec", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Adresse e-mail ou mot de passe incorrect." }), { status: 401 }),
    );
    render(<ConnexionPage />);

    fireEvent.change(screen.getByLabelText("Adresse e-mail"), { target: { value: "coach@example.test" } });
    fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: "mauvaispasse" } });
    fireEvent.click(screen.getByRole("button", { name: /se connecter/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Adresse e-mail ou mot de passe incorrect.");
  });

  it("propose de créer un compte", () => {
    render(<ConnexionPage />);

    expect(screen.getByRole("link", { name: /créer un compte/i })).toHaveAttribute("href", "/inscription");
  });
});
