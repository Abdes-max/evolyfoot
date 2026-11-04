import { resolveAccountFromRequest } from "@/server/auth";
import { createMarkNotificationsReadHandler, createNotificationGateway } from "@/server/notifications";

export async function POST(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createNotificationGateway();
  try {
    return await createMarkNotificationsReadHandler(resolveAccountFromRequest, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
