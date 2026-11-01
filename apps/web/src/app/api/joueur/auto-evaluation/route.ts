import { resolvePlayerAccountFromRequest } from "@/server/auth";
import { createAddSelfEvaluationHandler, createPlayerDashboardGateway } from "@/server/player-dashboard";

export async function POST(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createPlayerDashboardGateway();
  try {
    return await createAddSelfEvaluationHandler(resolvePlayerAccountFromRequest, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
