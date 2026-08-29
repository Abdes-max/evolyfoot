import { createAuthGateway, readSessionToken, type PublicEducator } from "@/server/auth";
import { createObservationGateway, createSaveObservationHandler } from "@/server/observation";

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

export async function POST(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createObservationGateway();
  try {
    return await createSaveObservationHandler(resolveEducator, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
