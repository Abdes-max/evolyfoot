import { createAuthGateway, readSessionToken, type PublicEducator } from "@/server/auth";
import {
  createListTrainingSessionsHandler,
  createSaveTrainingSessionHandler,
  createTrainingSessionGateway,
} from "@/server/training-session";

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
  const { gateway, disconnect } = await createTrainingSessionGateway();
  try {
    return await createListTrainingSessionsHandler(resolveEducator, gateway)(request);
  } finally {
    await disconnect();
  }
}

export async function POST(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createTrainingSessionGateway();
  try {
    return await createSaveTrainingSessionHandler(resolveEducator, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
