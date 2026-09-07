import { createAuthGateway, readSessionToken, type PublicEducator } from "@/server/auth";
import { createMetricsGateway, createMetricsHandler } from "@/server/metrics";

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
  const { gateway, disconnect } = await createMetricsGateway();
  try {
    return await createMetricsHandler(resolveEducator, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
