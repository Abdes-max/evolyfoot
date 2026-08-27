import { createAuthGateway, createRegisterHandler } from "@/server/auth";

export async function POST(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createAuthGateway();
  try {
    return await createRegisterHandler(gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
