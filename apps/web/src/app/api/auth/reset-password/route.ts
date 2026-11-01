import { createPasswordResetGateway, createResetPasswordHandler } from "@/server/password-reset";

// Route publique : le lien reçu par e-mail tient lieu d'authentification.
export async function POST(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createPasswordResetGateway();
  try {
    return await createResetPasswordHandler(gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
