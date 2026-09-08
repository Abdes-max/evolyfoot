import { createAuthGateway, readSessionToken, type PublicEducator } from "@/server/auth";
import { createCreateMatchHandler, createListMatchesHandler, createMatchGateway } from "@/server/match";

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

export async function GET(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createMatchGateway();
  try {
    return await createListMatchesHandler(resolveEducator, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}

export async function POST(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createMatchGateway();
  try {
    return await createCreateMatchHandler(resolveEducator, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
