import { runSuperAdmin } from "@/server/super-admin";

export async function PUT(request: Request): Promise<Response> {
  return runSuperAdmin((handlers) => handlers.changePassword(request));
}
