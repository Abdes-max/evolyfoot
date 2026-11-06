import { createAuthGateway, readSessionToken, type PublicEducator } from "@/server/auth";
import { createTutorsGateway, createTutorsHandlers } from "@/server/tutors";

async function resolveEducator(request: Request): Promise<PublicEducator | null> {
  const token = readSessionToken(request);
  if (!token) {
    return null;
  }

  const { gateway, disconnect } = await createAuthGateway();
  try {
    return await gateway.getEducatorForSession(token);
  } finally {
    await disconnect();
  }
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function run(request: Request, params: RouteParams["params"], action: "list" | "answer" | "remove"): Promise<Response> {
  const { id } = await params;
  const { gateway, disconnect } = await createTutorsGateway();
  try {
    return await createTutorsHandlers(resolveEducator, gateway, console.error)[action](request, id);
  } finally {
    await disconnect();
  }
}

export function GET(request: Request, { params }: RouteParams): Promise<Response> {
  return run(request, params, "list");
}

export function POST(request: Request, { params }: RouteParams): Promise<Response> {
  return run(request, params, "answer");
}

export function DELETE(request: Request, { params }: RouteParams): Promise<Response> {
  return run(request, params, "remove");
}
