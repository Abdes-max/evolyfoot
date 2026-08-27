import { createAuthGateway, readSessionToken, type PublicEducator } from "@/server/auth";
import { createGetTeamHandler, createSaveTeamHandler, createTeamGateway } from "@/server/team";

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
  const { gateway, disconnect } = await createTeamGateway();
  try {
    return await createGetTeamHandler(resolveEducator, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}

export async function PUT(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createTeamGateway();
  try {
    return await createSaveTeamHandler(resolveEducator, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
