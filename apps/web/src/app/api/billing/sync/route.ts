import { resolveOwnAccountFromRequest } from "@/server/auth";
import { createBillingStore, createStripeGateway, createSyncHandler } from "@/server/billing";

export async function POST(request: Request): Promise<Response> {
  const { store, disconnect } = await createBillingStore();
  try {
    return await createSyncHandler(resolveOwnAccountFromRequest, store, await createStripeGateway(), console.error)(request);
  } finally {
    await disconnect();
  }
}
