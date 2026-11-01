import { resolveOwnAccountFromRequest } from "@/server/auth";
import { createChangePasswordHandler, createProfileGateway } from "@/server/profile";

export async function PATCH(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createProfileGateway();
  try {
    return await createChangePasswordHandler(resolveOwnAccountFromRequest, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
