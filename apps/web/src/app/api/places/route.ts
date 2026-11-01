import { createAuthGateway, readSessionToken, type PublicEducator } from "@/server/auth";
import { createSearchPlacesHandler, searchPlaces } from "@/server/places";

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
  return createSearchPlacesHandler(resolveEducator, searchPlaces, console.error)(request);
}
