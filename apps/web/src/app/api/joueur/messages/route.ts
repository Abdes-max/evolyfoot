import { resolvePlayerAccountFromRequest } from "@/server/auth";
import { createListPlayerMessagesHandler, createMessagingGateway, createSendPlayerMessageHandler } from "@/server/messaging";

export async function GET(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createMessagingGateway();
  try {
    return await createListPlayerMessagesHandler(resolvePlayerAccountFromRequest, gateway, console.error)(request);
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
