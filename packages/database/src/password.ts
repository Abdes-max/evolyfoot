import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const MIN_PASSWORD_LENGTH = 10;

export function validatePassword(password: string): string {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error("Le mot de passe doit contenir au moins 10 caractères.");
  }

  return password;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) {
    return false;
  }

  const keyBuffer = Buffer.from(key, "hex");
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  if (derivedKey.length !== keyBuffer.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, keyBuffer);
}
