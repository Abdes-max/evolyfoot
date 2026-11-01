import { createContactGateway, createSubmitContactHandler } from "@/server/contact";
import { hour, limitByAddress } from "@/server/rate-limit";

// Route publique : le formulaire de contact du site vitrine, accessible sans session.
export async function POST(request: Request): Promise<Response> {
  const tooMany = limitByAddress(request, "contact", 5, hour);
  if (tooMany) {
    return tooMany;
  }

  const { gateway, disconnect } = await createContactGateway();
  try {
    return await createSubmitContactHandler(gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
