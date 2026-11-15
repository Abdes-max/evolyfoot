import { resolveOwnAccountFromRequest } from "@/server/auth";
import { createChangePasswordHandler, createProfileGateway } from "@/server/profile";
import { rejectIfImpersonating } from "@/server/super-admin";

export async function PATCH(request: Request): Promise<Response> {
  const impersonated = await rejectIfImpersonating(request);
  if (impersonated) {
    return impersonated;
  }

  const { gateway, disconnect } = await createProfileGateway();
  try {
    return await createChangePasswordHandler(resolveOwnAccountFromRequest, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
