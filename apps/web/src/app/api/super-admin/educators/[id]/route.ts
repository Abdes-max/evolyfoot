import { runSuperAdmin } from "@/server/super-admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams): Promise<Response> {
  const { id } = await params;
  return runSuperAdmin((handlers) => handlers.getEducator(request, id));
}

export async function DELETE(request: Request, { params }: RouteParams): Promise<Response> {
  const { id } = await params;
  return runSuperAdmin((handlers) => handlers.deleteEducator(request, id));
}
