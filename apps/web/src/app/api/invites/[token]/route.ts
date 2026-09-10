import { createPlayerInviteGateway, createPreviewInviteHandler } from "@/server/player-invite";

interface RouteParams {
  params: Promise<{ token: string }>;
}

export async function GET(request: Request, { params }: RouteParams): Promise<Response> {
  const { token } = await params;
  const { gateway, disconnect } = await createPlayerInviteGateway();
  try {
    return await createPreviewInviteHandler(gateway, console.error)(request, token);
  } finally {
    await disconnect();
  }
}
