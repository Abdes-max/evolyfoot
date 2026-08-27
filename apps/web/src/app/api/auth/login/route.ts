import { createAuthGateway, createLoginHandler } from "@/server/auth";

export async function POST(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createAuthGateway();
  try {
    return await createLoginHandler(gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
