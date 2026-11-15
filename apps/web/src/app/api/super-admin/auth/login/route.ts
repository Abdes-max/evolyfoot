import { runSuperAdmin } from "@/server/super-admin";

export async function POST(request: Request): Promise<Response> {
  return runSuperAdmin((handlers) => handlers.login(request));
}
