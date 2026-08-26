import {
  checkDatabaseConnection,
  createDatabaseHealthHandler,
} from "@/server/database-health";

export const GET = createDatabaseHealthHandler(
  checkDatabaseConnection,
  console.error,
);
