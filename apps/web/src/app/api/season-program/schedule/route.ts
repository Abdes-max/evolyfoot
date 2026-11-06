import { createAuthGateway, readSessionToken, type PublicEducator } from "@/server/auth";
import { createSaveSeasonScheduleHandler, createSeasonProgramGateway } from "@/server/season-program";

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

export async function PUT(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createSeasonProgramGateway();
  try {
    return await createSaveSeasonScheduleHandler(resolveEducator, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
