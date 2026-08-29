import { createAuthGateway, readSessionToken, type PublicEducator } from "@/server/auth";
import { createDiagnosticGateway, createGetDiagnosticHandler, createSaveDiagnosticHandler } from "@/server/diagnostic";

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
  const { gateway, disconnect } = await createDiagnosticGateway();
  try {
    return await createGetDiagnosticHandler(resolveEducator, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}

export async function PUT(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createDiagnosticGateway();
  try {
    return await createSaveDiagnosticHandler(resolveEducator, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
