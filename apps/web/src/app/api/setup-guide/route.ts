import { resolveOwnAccountFromRequest, resolveTeamOwnerFromRequest } from "@/server/auth";
import { createGetSetupGuideHandler, createSetupGuideGateway } from "@/server/setup-guide";

export async function GET(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createSetupGuideGateway();
  try {
    return await createGetSetupGuideHandler(
      { resolveAccount: resolveOwnAccountFromRequest, resolveTeam: resolveTeamOwnerFromRequest },
      gateway,
      console.error,
    )(request);
  } finally {
    await disconnect();
  }
}
