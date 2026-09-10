import { createConsumeInviteHandler, createPlayerInviteGateway } from "@/server/player-invite";

export async function POST(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createPlayerInviteGateway();
  try {
    return await createConsumeInviteHandler(gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
