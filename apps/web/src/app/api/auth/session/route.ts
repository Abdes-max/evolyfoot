import { createAuthGateway, createSessionHandler } from "@/server/auth";
import { impersonationOfRequest } from "@/server/super-admin";

export async function GET(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createAuthGateway();
  try {
    const response = await createSessionHandler(gateway, console.error)(request);
    const body = (await response.json()) as { educator: unknown };
    // Bandeau « Connecté en tant que … » : seulement pour une session ouverte par un superadmin.
    const impersonation = body.educator ? await impersonationOfRequest(request) : null;
    return Response.json(impersonation ? { ...body, impersonatedBy: impersonation.superAdminEmail } : body);
  } finally {
    await disconnect();
  }
}
