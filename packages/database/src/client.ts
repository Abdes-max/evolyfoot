import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

export function createDatabaseClient(databaseUrl: string): {
  readonly prisma: PrismaClient;
  disconnect(): Promise<void>;
} {
  if (!databaseUrl.trim()) {
    throw new Error("DATABASE_URL est obligatoire.");
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  return {
    prisma,
    disconnect: () => prisma.$disconnect(),
  };
}
