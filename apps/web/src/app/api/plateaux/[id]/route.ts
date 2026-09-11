import { createAuthGateway, readSessionToken, type PublicEducator } from "@/server/auth";
import { createGetPlateauHandler, createPlateauGateway, createRemovePlateauHandler } from "@/server/plateau";

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
  const { gateway, disconnect } = await createPlateauGateway();
  try {
    return await createGetPlateauHandler(resolveEducator, gateway, console.error)(request, id);
  } finally {
    await disconnect();
  }
}

export async function DELETE(request: Request, { params }: RouteParams): Promise<Response> {
  const { id } = await params;
  const { gateway, disconnect } = await createPlateauGateway();
  try {
    return await createRemovePlateauHandler(resolveEducator, gateway, console.error)(request, id);
  } finally {
    await disconnect();
  }
}
