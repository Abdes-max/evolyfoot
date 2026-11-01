import { createAuthGateway, readSessionToken, type PublicEducator } from "@/server/auth";
import { createAddPersonalExerciseHandler, createListPersonalExercisesHandler, createPersonalExerciseGateway } from "@/server/personal-exercise";

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
  const { gateway, disconnect } = await createPersonalExerciseGateway();
  try {
    return await createListPersonalExercisesHandler(resolveEducator, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}

export async function POST(request: Request): Promise<Response> {
  const { gateway, disconnect } = await createPersonalExerciseGateway();
  try {
    return await createAddPersonalExerciseHandler(resolveEducator, gateway, console.error)(request);
  } finally {
    await disconnect();
  }
}
