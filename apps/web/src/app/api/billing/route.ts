import { resolveOwnAccountFromRequest } from "@/server/auth";
import { createBillingStore, createGetBillingHandler, createStripeGateway } from "@/server/billing";
import { sendSubscriptionNotice } from "@/server/billing-reminders";

export async function GET(request: Request): Promise<Response> {
  const { store, disconnect } = await createBillingStore();
  try {
    return await createGetBillingHandler(resolveOwnAccountFromRequest, store, await createStripeGateway(), console.error, sendSubscriptionNotice)(request);
  } finally {
    await disconnect();
  }
}
