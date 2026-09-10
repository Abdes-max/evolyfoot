import { resolvePlayerAccountFromRequest } from "@/server/auth";
import { createGetPlayerDashboardHandler, createPlayerDashboardGateway } from "@/server/player-dashboard";

export async function GET(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createPlayerDashboardGateway();
  try {
    return await createGetPlayerDashboardHandler(resolvePlayerAccountFromRequest, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
