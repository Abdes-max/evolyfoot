import { resolvePlayerAccountFromRequest } from "@/server/auth";
import { createPlayerRsvpGateway, createRespondToMatchHandler } from "@/server/player-rsvp";

export async function POST(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createPlayerRsvpGateway();
  try {
    return await createRespondToMatchHandler(resolvePlayerAccountFromRequest, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
