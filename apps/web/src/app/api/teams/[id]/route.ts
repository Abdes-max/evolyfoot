import { resolveOwnAccountFromRequest } from "@/server/auth";
import { createRemoveTeamHandler, createTeamSpaceGateway } from "@/server/team-spaces";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const { gateway, disconnect } = await createTeamSpaceGateway();
  try {
    return await createRemoveTeamHandler(resolveOwnAccountFromRequest, gateway, console.error)(request, id);
  } finally {
    await disconnect();
  }
}
