import { ValidationError } from "./errors";

export interface ContactMessageInput {
  name: string;
  email: string;
  message: string;
}

export interface ContactMessageRecord {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: Date;
}

export interface ContactMessageRepository {
  create(input: { name: string; email: string; message: string }): Promise<ContactMessageRecord>;
  list(limit: number): Promise<ContactMessageRecord[]>;
}

const MAX_NAME = 120;
const MAX_EMAIL = 200;
const MAX_MESSAGE = 4000;

export class ContactMessageService {
  constructor(private readonly repository: ContactMessageRepository) {}

  async submit(input: ContactMessageInput): Promise<ContactMessageRecord> {
    const name = input.name.trim();
    const email = input.email.trim();
    const message = input.message.trim();
    if (!name || name.length > MAX_NAME) {
      throw new ValidationError("Indique ton nom.");
    }
    if (!email || !email.includes("@") || email.length > MAX_EMAIL) {
      throw new ValidationError("Indique une adresse e-mail valide.");
    }
    if (!message || message.length > MAX_MESSAGE) {
      throw new ValidationError("Écris ton message.");
    }
    return this.repository.create({ name, email, message });
  }

  list(limit = 50): Promise<ContactMessageRecord[]> {
    return this.repository.list(limit);
  }
}
