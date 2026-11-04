import { resolveOwnAccountFromRequest } from "@/server/auth";
import { createClubGateway, createCreateOrJoinClubHandler, createGetClubHandler, createLeaveClubHandler } from "@/server/club";

export async function GET(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createClubGateway();
  try {
    return await createGetClubHandler(resolveOwnAccountFromRequest, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}

export async function POST(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createClubGateway();
  try {
    return await createCreateOrJoinClubHandler(resolveOwnAccountFromRequest, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createClubGateway();
  try {
    return await createLeaveClubHandler(resolveOwnAccountFromRequest, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
