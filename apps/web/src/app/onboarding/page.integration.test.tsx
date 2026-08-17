import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import OnboardingPage from "./page";
describe("team onboarding", () => { it("valide les repères essentiels", () => { render(<OnboardingPage/>); fireEvent.change(screen.getByLabelText("Nom de l’équipe"),{target:{value:"FC Horizon"}}); fireEvent.click(screen.getByRole("button",{name:"Mar"})); fireEvent.click(screen.getByRole("button",{name:"Jeu"})); fireEvent.click(screen.getByRole("button",{name:/valider mon équipe/i})); expect(screen.getByRole("status")).toHaveTextContent("Équipe prête"); }); });
