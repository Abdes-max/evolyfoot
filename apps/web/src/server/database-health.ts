export function createDatabaseHealthHandler(
  check: () => Promise<void>,
  log: (error: unknown) => void,
): () => Promise<Response> {
  return async () => {
    try {
      await check();

      return Response.json({ status: "ok" });
    } catch (error) {
      log(error);

      return Response.json({ status: "unavailable" }, { status: 503 });
    }
  };
}

export async function checkDatabaseConnection(): Promise<void> {
  const { createDatabaseClient } = await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");

  try {
    await database.prisma.$queryRaw`SELECT 1`;
  } finally {
    await database.disconnect();
  }
}
