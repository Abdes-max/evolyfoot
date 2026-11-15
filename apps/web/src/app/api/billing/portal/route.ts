import { rejectIfImpersonating } from "@/server/super-admin";
import { resolveOwnAccountFromRequest } from "@/server/auth";
import { createBillingStore, createPortalHandler, createStripeGateway } from "@/server/billing";
import { resolveOrigin } from "@/server/request-origin";

export async function POST(request: Request): Promise<Response> {
  const impersonated = await rejectIfImpersonating(request);
  if (impersonated) {
    return impersonated;
  }

  const { store, disconnect } = await createBillingStore();
  try {
    return await createPortalHandler(resolveOwnAccountFromRequest, store, await createStripeGateway(), resolveOrigin, console.error)(request);
  } finally {
    await disconnect();
  }
}
