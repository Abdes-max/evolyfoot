import { createAccountGateway, createExportAccountHandler } from "@/server/account";
import { resolveAccountFromRequest } from "@/server/auth";

export async function GET(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createAccountGateway();
  try {
    return await createExportAccountHandler(resolveAccountFromRequest, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
