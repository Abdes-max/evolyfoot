import { resolveOwnAccountFromRequest } from "@/server/auth";
import { createBillingStore, createGetBillingHandler } from "@/server/billing";

export async function GET(request: Request): Promise<Response> {
  const { store, disconnect } = await createBillingStore();
  try {
    const enabled = Boolean(process.env.STRIPE_SECRET_KEY?.trim() && process.env.STRIPE_WEBHOOK_SECRET?.trim());
    return await createGetBillingHandler(resolveOwnAccountFromRequest, store, enabled, console.error)(request);
  } finally {
    await disconnect();
  }
}
