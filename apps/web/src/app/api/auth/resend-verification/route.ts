import { resolveOwnAccountFromRequest } from "@/server/auth";
import { createEmailVerificationGateway, createResendVerificationHandler } from "@/server/email-verification";

export async function POST(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createEmailVerificationGateway();
  try {
    return await createResendVerificationHandler(resolveOwnAccountFromRequest, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
