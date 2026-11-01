import { hour, limitByAddress } from "@/server/rate-limit";
import { createJoinStaffHandler, createStaffGateway } from "@/server/staff";

export async function POST(request: Request): Promise<Response> {
  const tooMany = limitByAddress(request, "register-assistant", 10, hour);
  if (tooMany) {
    return tooMany;
  }

  const { gateway, disconnect } = await createStaffGateway();
  try {
    return await createJoinStaffHandler(gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
