import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DiagnosticPage from "./page";
describe("initial diagnostic",()=>{it("explique les deux priorités au coach",()=>{render(<DiagnosticPage/>);fireEvent.click(screen.getByRole("button",{name:"Réagir après la perte : Rarement"}));fireEvent.click(screen.getByRole("button",{name:"Voir mes priorités"}));expect(screen.getByRole("status")).toHaveTextContent("Réagir après la perte");expect(screen.getByRole("status")).toHaveTextContent("Récupérer rapidement");});});
