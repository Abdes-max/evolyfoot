import { resolveOwnAccountFromRequest } from "@/server/auth";
import { createBillingStore, createCheckoutHandler, createStripeGateway } from "@/server/billing";
import { resolveOrigin } from "@/server/request-origin";

export async function POST(request: Request): Promise<Response> {
  const { store, disconnect } = await createBillingStore();
  try {
    return await createCheckoutHandler(resolveOwnAccountFromRequest, store, await createStripeGateway(), resolveOrigin, console.error)(request);
  } finally {
    await disconnect();
  }
}
