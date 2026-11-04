import { resolveOwnAccountFromRequest } from "@/server/auth";
import { createActivateTeamHandler, createTeamSpaceGateway } from "@/server/team-spaces";

export async function PUT(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createTeamSpaceGateway();
  try {
    return await createActivateTeamHandler(resolveOwnAccountFromRequest, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
