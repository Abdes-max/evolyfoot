#!/usr/bin/env node
// Crée un compte superadmin EvolyFoot.
//
//   DATABASE_URL=postgresql://... node scripts/create-super-admin.mjs --email vous@exemple.fr --name "Votre nom"
//
// Le mot de passe est demandé deux fois dans le terminal (12 caractères minimum) : il n'est jamais passé en
// argument, jamais écrit dans un fichier ni dans l'historique du shell. Le script n'écrit qu'en base.
// Il ne se lance pas en CI : voir docs/delivery.md pour l'exécution sur le serveur.
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { createRequire } from "node:module";
import { promisify } from "node:util";

const require = createRequire(new URL("../packages/database/package.json", import.meta.url));
const { Client } = require("pg");
const scrypt = promisify(scryptCallback);

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function fail(message) {
  console.error(`Erreur : ${message}`);
  process.exit(1);
}

// Lecture d'un mot de passe sans écho dans le terminal.
function askHidden(question) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error("Ce script demande le mot de passe dans un terminal interactif (docker exec -it ...)."));
      return;
    }
    process.stdout.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    let value = "";
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === "\u0003") {
          process.stdout.write("\n");
          process.exit(130);
        } else if (char === "\r" || char === "\n") {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.off("data", onData);
          process.stdout.write("\n");
          resolve(value);
          return;
        } else if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
        } else {
          value += char;
        }
      }
    };
    process.stdin.on("data", onData);
  });
}

// Même format que packages/database/src/password.ts : « sel:clé » en hexadécimal.
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString("hex")}`;
}

const email = argument("email")?.trim().toLowerCase();
const displayName = argument("name")?.trim();
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) fail("DATABASE_URL est obligatoire.");
if (!email || email.length > 254 || !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)) fail("--email doit être une adresse e-mail valide.");
if (!displayName || displayName.length > 120) fail('--name est obligatoire (120 caractères maximum), par exemple --name "Votre nom".');
if (process.argv.some((arg) => arg.startsWith("--password"))) fail("Le mot de passe ne se passe pas en argument : il est demandé dans le terminal.");

const password = await askHidden(`Mot de passe (${MIN_PASSWORD_LENGTH} caractères minimum) : `);
if (password.length < MIN_PASSWORD_LENGTH) fail(`le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`);
if (password.length > MAX_PASSWORD_LENGTH) fail(`le mot de passe ne doit pas dépasser ${MAX_PASSWORD_LENGTH} caractères.`);
if ((await askHidden("Confirme le mot de passe : ")) !== password) fail("les deux mots de passe sont différents.");

const client = new Client({ connectionString: databaseUrl });
await client.connect();
try {
  const existing = await client.query('SELECT 1 FROM "super_admins" WHERE "email" = $1', [email]);
  if (existing.rowCount > 0) fail("un superadmin existe déjà avec cette adresse.");
  await client.query('INSERT INTO "super_admins" ("id", "email", "display_name", "password_hash") VALUES (gen_random_uuid(), $1, $2, $3)', [
    email,
    displayName,
    await hashPassword(password),
  ]);
  console.log(`Superadmin créé : ${email}. Connexion sur /super-admin/login.`);
} finally {
  await client.end();
}
