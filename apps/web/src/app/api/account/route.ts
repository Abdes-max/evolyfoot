import { createAccountGateway, createDeleteAccountHandler } from "@/server/account";
import { resolveAccountFromRequest } from "@/server/auth";
import { hour, limitByAddress } from "@/server/rate-limit";

export async function DELETE(request: Request): Promise<Response> {
  const tooMany = limitByAddress(request, "delete-account", 10, hour);
  if (tooMany) {
    return tooMany;
  }

  const { gateway, disconnect } = await createAccountGateway();
  try {
    return await createDeleteAccountHandler(resolveAccountFromRequest, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
