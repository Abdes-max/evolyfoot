import { resolvePlayerAccountFromRequest } from "@/server/auth";
import { markNotificationsRead } from "@/server/notifications";
import { createListPlayerMessagesHandler, createMessagingGateway, createSendPlayerMessageHandler } from "@/server/messaging";

export async function GET(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createMessagingGateway();
  try {
    const response = await createListPlayerMessagesHandler(resolvePlayerAccountFromRequest, gateway, console.error)(request);
    const reader = response.ok ? await resolvePlayerAccountFromRequest(request) : null;
    if (reader) await markNotificationsRead(reader.id, { kind: "message" });
    return response;
  } finally {
    await disconnect();
  }
}

export async function POST(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createMessagingGateway();
  try {
    return await createSendPlayerMessageHandler(resolvePlayerAccountFromRequest, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
