import type { PublicEducator } from "@/server/auth";
import { createEmailVerificationGateway } from "@/server/email-verification";
import { createConsumeInviteHandler, createPlayerInviteGateway } from "@/server/player-invite";
import { resolveOrigin } from "@/server/request-origin";

// Même principe que /api/auth/register : le lien part après la création du compte, et un échec
// d'envoi ne fait jamais échouer celle-ci.
async function sendVerificationEmail(account: PublicEducator, origin: string): Promise<void> {
  const { gateway, disconnect } = await createEmailVerificationGateway();
  try {
    await gateway.send(account, origin);
  } finally {
    await disconnect();
  }
}

export async function POST(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createPlayerInviteGateway();
  try {
    const response = await createConsumeInviteHandler(gateway, console.error)(request);
    if (response.status === 201) {
      const body: { educator?: PublicEducator; account?: PublicEducator } = await response.clone().json();
      const account = body.educator ?? body.account;
      if (account) {
        await sendVerificationEmail(account, resolveOrigin(request));
      }
    }
    return response;
  } finally {
    await disconnect();
  }
}
