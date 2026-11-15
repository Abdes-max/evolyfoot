import { runSuperAdmin } from "@/server/super-admin";

export async function GET(request: Request): Promise<Response> {
  return runSuperAdmin((handlers) => handlers.auditLog(request));
}
