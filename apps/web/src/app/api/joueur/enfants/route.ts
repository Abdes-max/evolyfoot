import { resolvePlayerAccountFromRequest } from "@/server/auth";
import { createPlayerChildrenGateway, createPlayerChildrenHandlers } from "@/server/player-children";

async function handle(request: Request, pick: "list" | "select" | "attach"): Promise<Response> {
  const { gateway, disconnect } = await createPlayerChildrenGateway();
  try {
    return await createPlayerChildrenHandlers(resolvePlayerAccountFromRequest, gateway, console.error)[pick](request);
  } finally {
    await disconnect();
  }
}

export const GET = (request: Request) => handle(request, "list");
export const PUT = (request: Request) => handle(request, "select");
export const POST = (request: Request) => handle(request, "attach");
