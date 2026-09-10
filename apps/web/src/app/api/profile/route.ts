import { createAuthGateway, readSessionToken, type PublicEducator } from "@/server/auth";
import { createGetProfileHandler, createProfileGateway, createUpdateProfileHandler } from "@/server/profile";

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
  const { gateway, disconnect } = await createProfileGateway();
  try {
    return await createGetProfileHandler(resolveEducator, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createProfileGateway();
  try {
    return await createUpdateProfileHandler(resolveEducator, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
