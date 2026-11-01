import { createAuthGateway, readSessionToken, type PublicAccount } from "@/server/auth";
import { createMetricsGateway, createMetricsHandler } from "@/server/metrics";

async function resolveEducator(request: Request): Promise<PublicAccount | null> {
  const token = readSessionToken(request);
  if (!token) {
    return null;
  }

  const { gateway, disconnect } = await createAuthGateway();
  try {
    const account = await gateway.getAccountForSession(token);
    return account?.role === "coach" ? account : null;
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
