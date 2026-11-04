import { resolveOwnAccountFromRequest } from "@/server/auth";
import { createClubGateway, createListClubExercisesHandler } from "@/server/club";

export async function GET(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createClubGateway();
  try {
    return await createListClubExercisesHandler(resolveOwnAccountFromRequest, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
