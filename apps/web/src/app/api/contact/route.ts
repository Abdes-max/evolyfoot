import { createContactGateway, createSubmitContactHandler } from "@/server/contact";

// Route publique : le formulaire de contact du site vitrine, accessible sans session.
export async function POST(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createContactGateway();
  try {
    return await createSubmitContactHandler(gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
