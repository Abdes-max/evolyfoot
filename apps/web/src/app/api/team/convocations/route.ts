import { createAuthGateway, readSessionToken, type PublicEducator } from "@/server/auth";
import { createGetConvocationSettingsHandler, createSaveConvocationSettingsHandler, createTrainingConvocationGateway } from "@/server/training-convocation";

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
  const { gateway, disconnect } = await createTrainingConvocationGateway();
  try {
    return await createGetConvocationSettingsHandler(resolveEducator, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}

export async function PUT(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createTrainingConvocationGateway();
  try {
    return await createSaveConvocationSettingsHandler(resolveEducator, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
