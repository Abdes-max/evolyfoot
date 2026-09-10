import { createAuthGateway, readSessionToken, type PublicEducator } from "@/server/auth";
import { createPlayerEvaluationGateway, createSavePlayerEvaluationHandler } from "@/server/player-evaluation";

async function resolveEducator(request: Request): Promise<PublicEducator | null> {
  const token = readSessionToken(request);
  if (!token) {
    return null;
  }

  const { gateway, disconnect } = await createAuthGateway();
  try {
    return await gateway.getEducatorForSession(token);
  } finally {
    await disconnect();
  }
}

interface RouteParams {
  params: Promise<{ playerId: string }>;
}

export async function PUT(request: Request, { params }: RouteParams): Promise<Response> {
  const { playerId } = await params;
  const { gateway, disconnect } = await createPlayerEvaluationGateway();
  try {
    return await createSavePlayerEvaluationHandler(resolveEducator, gateway, console.error)(request, playerId);
  } finally {
    await disconnect();
  }
}
