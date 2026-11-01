import { createForgotPasswordHandler, createPasswordResetGateway } from "@/server/password-reset";
import { hour, limitByAddress } from "@/server/rate-limit";

// Route publique : par définition, le demandeur ne peut pas se connecter.
export async function POST(request: Request): Promise<Response> {
  const tooMany = limitByAddress(request, "forgot-password", 10, hour);
  if (tooMany) {
    return tooMany;
  }

  const { gateway, disconnect } = await createPasswordResetGateway();
  try {
    return await createForgotPasswordHandler(gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
