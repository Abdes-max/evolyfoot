import { createPreviewStaffInviteHandler, createStaffGateway } from "@/server/staff";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await params;
  const { gateway, disconnect } = await createStaffGateway();
  try {
    return await createPreviewStaffInviteHandler(gateway, console.error)(token);
  } finally {
    await disconnect();
  }
}
