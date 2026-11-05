import { resolvePlayerAccountFromRequest } from "@/server/auth";
import { createPlayerChildrenGateway, createPlayerChildrenHandlers } from "@/server/player-children";

export async function PUT(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createPlayerChildrenGateway();
  try {
    return await createPlayerChildrenHandlers(resolvePlayerAccountFromRequest, gateway, console.error).photo(request);
  } finally {
    await disconnect();
  }
}
