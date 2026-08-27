import { createAuthGateway, createLogoutHandler } from "@/server/auth";

export async function POST(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createAuthGateway();
  try {
    return await createLogoutHandler(gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
