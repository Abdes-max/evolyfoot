import { createAuthGateway, readSessionToken, type PublicEducator } from "@/server/auth";
import { createListPlayerEvaluationsHandler, createPlayerEvaluationGateway } from "@/server/player-evaluation";

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

export async function GET(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createPlayerEvaluationGateway();
  try {
    return await createListPlayerEvaluationsHandler(resolveEducator, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
