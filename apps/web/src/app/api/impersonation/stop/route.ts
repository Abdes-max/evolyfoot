import { runSuperAdmin } from "@/server/super-admin";

// Appelée par le bandeau « Quitter » de l'appli éducateur : le cookie présenté est celui de l'éducateur.
export async function POST(request: Request): Promise<Response> {
  return runSuperAdmin((handlers) => handlers.stopImpersonation(request));
}
