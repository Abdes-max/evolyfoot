import { resolveAccountFromRequest } from "@/server/auth";
import { createPushDeviceHandler, createNotificationGateway } from "@/server/notifications";

export async function POST(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createNotificationGateway();
  try {
    return await createPushDeviceHandler(resolveAccountFromRequest, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createNotificationGateway();
  try {
    return await createPushDeviceHandler(resolveAccountFromRequest, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
