import { resolveTeamOwnerFromRequest } from "@/server/auth";
import { resolveOrigin } from "@/server/request-origin";
import { createInviteStaffHandler, createListStaffHandler, createStaffGateway } from "@/server/staff";

export async function GET(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createStaffGateway();
  try {
    return await createListStaffHandler(resolveTeamOwnerFromRequest, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}

export async function POST(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createStaffGateway();
  try {
    return await createInviteStaffHandler(resolveTeamOwnerFromRequest, gateway, resolveOrigin, console.error)(request);
  } finally {
    await disconnect();
  }
}
