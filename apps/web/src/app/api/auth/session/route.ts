import { createAuthGateway, createSessionHandler } from "@/server/auth";

export async function GET(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createAuthGateway();
  try {
    return await createSessionHandler(gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
