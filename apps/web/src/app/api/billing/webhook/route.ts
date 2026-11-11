import { createBillingStore, createStripeGateway, createWebhookHandler } from "@/server/billing";

// Appelé par Stripe (événements customer.subscription.*), sans session : la signature fait foi.
export async function POST(request: Request): Promise<Response> {
  const { store, disconnect } = await createBillingStore();
  try {
    return await createWebhookHandler(store, await createStripeGateway(), console.error)(request);
  } finally {
    await disconnect();
  }
}
