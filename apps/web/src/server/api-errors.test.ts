import { describe, expect, it, vi } from "vitest";
import { databaseErrorResponse } from "./api-errors";

function prismaError(name: string, message: string, code?: string): Error {
  return Object.assign(new Error(message), { name, ...(code ? { code } : {}) });
}

describe("databaseErrorResponse", () => {
  it("laisse passer les erreurs métier", () => {
    expect(databaseErrorResponse(new Error("Adversaire requis."), vi.fn())).toBeNull();
    expect(databaseErrorResponse("texte", vi.fn())).toBeNull();
  });

  it("renvoie 404 pour un identifiant mal formé, sans le message de Prisma", async () => {
    const response = databaseErrorResponse(
      prismaError("PrismaClientKnownRequestError", "Invalid `x.findFirst()` invocation in C:\\secret\\file.ts", "P2023"),
      vi.fn(),
    );
    expect(response?.status).toBe(404);
    expect(JSON.stringify(await response?.json())).not.toContain("secret");
  });

  it("renvoie 404 pour un UUID invalide remonté par l'adaptateur (P2007)", async () => {
    const response = databaseErrorResponse(
      prismaError("PrismaClientKnownRequestError", 'Invalid input value: invalid input syntax for type uuid: "zzz" in C:\secret', "P2007"),
      vi.fn(),
    );
    expect(response?.status).toBe(404);
    expect(JSON.stringify(await response?.json())).not.toContain("secret");
  });

  it("renvoie 400 pour une valeur invalide, sans le chemin disque", async () => {
    const response = databaseErrorResponse(
      prismaError("PrismaClientValidationError", "Invalid `prisma.matchRecord.create()` invocation in C:\\secret\\file.ts"),
      vi.fn(),
    );
    expect(response?.status).toBe(400);
    expect(JSON.stringify(await response?.json())).not.toContain("secret");
  });

  it("reconnaît une erreur Prisma à son message même sans nom de classe", () => {
    const response = databaseErrorResponse(new Error("\nInvalid `prisma.matchRecord.create()` invocation in C:\\x"), vi.fn());
    expect(response?.status).toBe(500);
  });

  it("journalise et renvoie 500 pour les autres erreurs de base de données", async () => {
    const log = vi.fn();
    const response = databaseErrorResponse(prismaError("PrismaClientInitializationError", "Can't reach database at C:\\secret"), log);
    expect(response?.status).toBe(500);
    expect(log).toHaveBeenCalledOnce();
    expect(JSON.stringify(await response?.json())).not.toContain("secret");
  });
});
