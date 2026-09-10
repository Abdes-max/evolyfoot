import { createAuthGateway, readSessionToken, type PublicEducator } from "@/server/auth";
import { createGetTrainingSessionHandler, createTrainingSessionGateway } from "@/server/training-session";

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
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams): Promise<Response> {
  const { id } = await params;
  const { gateway, disconnect } = await createTrainingSessionGateway();
  try {
    return await createGetTrainingSessionHandler(resolveEducator, gateway)(request, id);
  } finally {
    await disconnect();
  }
}
