import { resolveAccountFromRequest } from "@/server/auth";
import { createListNotificationsHandler, createNotificationGateway } from "@/server/notifications";

export async function GET(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createNotificationGateway();
  try {
    return await createListNotificationsHandler(resolveAccountFromRequest, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
