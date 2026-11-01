import { resolveAccountFromRequest } from "@/server/auth";
import { createRemoveStaffHandler, createStaffGateway } from "@/server/staff";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const { gateway, disconnect } = await createStaffGateway();
  try {
    return await createRemoveStaffHandler(resolveAccountFromRequest, gateway, console.error)(request, id);
  } finally {
    await disconnect();
  }
}
