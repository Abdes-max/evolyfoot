import { resolveOwnAccountFromRequest } from "@/server/auth";
import { createCreateTeamHandler, createListTeamsHandler, createTeamSpaceGateway } from "@/server/team-spaces";

export async function GET(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createTeamSpaceGateway();
  try {
    return await createListTeamsHandler(resolveOwnAccountFromRequest, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}

export async function POST(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createTeamSpaceGateway();
  try {
    return await createCreateTeamHandler(resolveOwnAccountFromRequest, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
