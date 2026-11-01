import { createForgotPasswordHandler, createPasswordResetGateway } from "@/server/password-reset";

// Route publique : par définition, le demandeur ne peut pas se connecter.
export async function POST(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createPasswordResetGateway();
  try {
    return await createForgotPasswordHandler(gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
