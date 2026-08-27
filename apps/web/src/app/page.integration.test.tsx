import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("tableau de bord", () => {
  it("relie la priorité du cycle à la prochaine séance", () => {
    render(<Home />);

    expect(screen.getByText("Créer des solutions autour du porteur")).toBeInTheDocument();
    expect(screen.getByText("Jouer, bouger, proposer")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ouvrir la séance/i })).toHaveAttribute("href", "/session");
  });
});
