import { createAuthGateway, readSessionToken, type PublicEducator } from "@/server/auth";
import { createAddPlayerHandler, createListRosterHandler, createRosterGateway } from "@/server/roster";

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
  const { gateway, disconnect } = await createRosterGateway();
  try {
    return await createListRosterHandler(resolveEducator, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}

export async function POST(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createRosterGateway();
  try {
    return await createAddPlayerHandler(resolveEducator, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
