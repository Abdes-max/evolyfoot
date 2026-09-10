import { createAuthGateway, readSessionToken, type PublicEducator } from "@/server/auth";
import { createCreateInviteHandler, createPlayerInviteGateway } from "@/server/player-invite";

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

export async function POST(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createPlayerInviteGateway();
  try {
    return await createCreateInviteHandler(resolveEducator, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
