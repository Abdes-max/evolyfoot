import { createAuthGateway, readSessionToken, type PublicEducator } from "@/server/auth";
import { createRemoveTournamentHandler, createTournamentGateway } from "@/server/tournament";

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

export async function DELETE(request: Request, { params }: RouteParams): Promise<Response> {
  const { id } = await params;
  const { gateway, disconnect } = await createTournamentGateway();
  try {
    return await createRemoveTournamentHandler(resolveEducator, gateway, console.error)(request, id);
  } finally {
    await disconnect();
  }
}
