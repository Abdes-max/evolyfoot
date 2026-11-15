import { runSuperAdmin } from "@/server/super-admin";

interface RouteParams {
  params: Promise<{ id: string; action: string }>;
}

export async function POST(request: Request, { params }: RouteParams): Promise<Response> {
  const { id, action } = await params;
  return runSuperAdmin((handlers) => handlers.educatorAction(request, id, action));
}
