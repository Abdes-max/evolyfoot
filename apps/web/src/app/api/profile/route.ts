import { resolveOwnAccountFromRequest } from "@/server/auth";
import { createGetProfileHandler, createProfileGateway, createUpdateProfileHandler } from "@/server/profile";

export async function GET(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createProfileGateway();
  try {
    return await createGetProfileHandler(resolveOwnAccountFromRequest, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createProfileGateway();
  try {
    return await createUpdateProfileHandler(resolveOwnAccountFromRequest, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
