import { createAuthGateway, readSessionToken, type PublicEducator } from "@/server/auth";
import { convocationMailer, createCancelTrainingSessionHandler, createConvocationGateway, createRestoreTrainingSessionHandler } from "@/server/convocation";

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

// POST : annule l'entraînement et prévient les joueurs concernés.
export async function POST(request: Request, { params }: RouteParams): Promise<Response> {
  const { id } = await params;
  const { gateway, disconnect } = await createConvocationGateway();
  try {
    return await createCancelTrainingSessionHandler(resolveEducator, gateway, console.error, convocationMailer)(request, id);
  } finally {
    await disconnect();
  }
}

// DELETE : rétablit l'entraînement annulé.
export async function DELETE(request: Request, { params }: RouteParams): Promise<Response> {
  const { id } = await params;
  const { gateway, disconnect } = await createConvocationGateway();
  try {
    return await createRestoreTrainingSessionHandler(resolveEducator, gateway, console.error)(request, id);
  } finally {
    await disconnect();
  }
}
