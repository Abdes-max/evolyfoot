import { createAuthGateway, readSessionToken, type PublicEducator } from "@/server/auth";
import { createConvocationGateway, createSendTrainingSessionConvocationHandler } from "@/server/convocation";

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

export async function POST(request: Request, { params }: RouteParams): Promise<Response> {
  const { id } = await params;
  const { gateway, disconnect } = await createConvocationGateway();
  try {
    return await createSendTrainingSessionConvocationHandler(resolveEducator, gateway, console.error)(request, id);
  } finally {
    await disconnect();
  }
}
