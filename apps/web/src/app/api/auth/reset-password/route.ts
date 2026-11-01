import { createPasswordResetGateway, createResetPasswordHandler } from "@/server/password-reset";
import { hour, limitByAddress } from "@/server/rate-limit";

// Route publique : le lien reçu par e-mail tient lieu d'authentification.
export async function POST(request: Request): Promise<Response> {
  const tooMany = limitByAddress(request, "reset-password", 20, hour);
  if (tooMany) {
    return tooMany;
  }

  const { gateway, disconnect } = await createPasswordResetGateway();
  try {
    return await createResetPasswordHandler(gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
