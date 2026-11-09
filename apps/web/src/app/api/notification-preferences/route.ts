import { resolveAccountFromRequest } from "@/server/auth";
import { createNotificationGateway, createNotificationPreferencesHandler } from "@/server/notifications";

async function handle(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createNotificationGateway();
  try {
    return await createNotificationPreferencesHandler(resolveAccountFromRequest, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}

export const GET = handle;
export const PUT = handle;
