import { createAuthGateway, createLoginHandler } from "@/server/auth";
import { limitLogin } from "@/server/rate-limit";

export async function POST(request: Request): Promise<Response> {
  const tooMany = await limitLogin(request);
  if (tooMany) {
    return tooMany;
  }

  const { gateway, disconnect } = await createAuthGateway();
  try {
    return await createLoginHandler(gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
