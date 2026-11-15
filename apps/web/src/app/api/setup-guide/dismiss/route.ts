import { resolveOwnAccountFromRequest, resolveTeamOwnerFromRequest } from "@/server/auth";
import { createDismissSetupGuideHandler, createSetupGuideGateway } from "@/server/setup-guide";

// Corps `{ dismissed: false }` pour rouvrir le guide ; sinon il est fermé.
export async function POST(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createSetupGuideGateway();
  try {
    return await createDismissSetupGuideHandler(
      { resolveAccount: resolveOwnAccountFromRequest, resolveTeam: resolveTeamOwnerFromRequest },
      gateway,
      console.error,
    )(request);
  } finally {
    await disconnect();
  }
}
