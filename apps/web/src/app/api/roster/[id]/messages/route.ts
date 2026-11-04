import { createAuthGateway, readSessionToken, resolveAccountFromRequest, type PublicEducator } from "@/server/auth";
import { markNotificationsRead } from "@/server/notifications";
import { createListCoachMessagesHandler, createMessagingGateway, createSendCoachMessageHandler } from "@/server/messaging";

async function resolveEducator(request: Request): Promise<PublicEducator | null> {
  const token = readSessionToken(request);
  if (!token) {
    return null;
  }

  const { gateway, disconnect } = await createAuthGateway();
  try {
    return await gateway.getEducatorForSession(token);
  } finally {
    await disconnect();
  }
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams): Promise<Response> {
  const { id } = await params;
  const { gateway, disconnect } = await createMessagingGateway();
  try {
    const response = await createListCoachMessagesHandler(resolveEducator, gateway, console.error)(request, id);
    const reader = response.ok ? await resolveAccountFromRequest(request) : null;
    if (reader) await markNotificationsRead(reader.id, { threadPlayerId: id });
    return response;
  } finally {
    await disconnect();
  }
}

export async function POST(request: Request, { params }: RouteParams): Promise<Response> {
  const { id } = await params;
  const { gateway, disconnect } = await createMessagingGateway();
  try {
    return await createSendCoachMessageHandler(resolveEducator, gateway, console.error)(request, id);
  } finally {
    await disconnect();
  }
}
