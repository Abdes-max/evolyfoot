import { ValidationError } from "@evolyfoot/database";

export interface ContactGateway {
  submit(input: { name: string; email: string; message: string }): Promise<void>;
}

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function createSubmitContactHandler(
  contact: ContactGateway,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const body = await readJsonBody(request);
    const name = typeof body?.name === "string" ? body.name : null;
    const email = typeof body?.email === "string" ? body.email : null;
    const message = typeof body?.message === "string" ? body.message : null;
    if (name === null || email === null || message === null) {
      return Response.json({ error: "Nom, e-mail et message sont requis." }, { status: 400 });
    }

    try {
      await contact.submit({ name, email, message });
      return Response.json({ status: "ok" }, { status: 201 });
    } catch (error) {
      if (error instanceof ValidationError) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      log(error);
      return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
  };
}

export async function createContactGateway(): Promise<{ gateway: ContactGateway; disconnect: () => Promise<void> }> {
  const { createDatabaseClient, PrismaContactMessageRepository, ContactMessageService } = await import("@evolyfoot/database");
  const database = createDatabaseClient(process.env.DATABASE_URL ?? "");
  const service = new ContactMessageService(new PrismaContactMessageRepository(database.prisma));

  return {
    gateway: {
      async submit(input) {
        await service.submit(input);
      },
    },
    disconnect: database.disconnect,
  };
}
