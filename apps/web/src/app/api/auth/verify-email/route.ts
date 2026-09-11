import { createConsumeVerificationHandler, createEmailVerificationGateway } from "@/server/email-verification";

// Route publique : le lien reçu par e-mail n'a pas de session (voir /verifier-email/[token]).
export async function POST(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createEmailVerificationGateway();
  try {
    return await createConsumeVerificationHandler(gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
