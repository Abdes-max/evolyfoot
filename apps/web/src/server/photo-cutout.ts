import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { PublicAccount } from "./auth";
import { hitRateLimit, hour } from "./rate-limit";

// Taille maximale de la photo reçue (data URL) : l'appli la redimensionne déjà avant l'envoi.
const maxInputLength = 3_000_000;

// Le modèle occupe le processeur 2 à 3 s par photo : un compte ne peut pas en enchaîner sans fin,
// et le serveur n'en traite que quelques-unes à la fois.
const cutoutsPerHour = 30;
const maxConcurrentCutouts = 2;
let runningCutouts = 0;
// Au-delà, la photo est réduite avant le modèle : une image minuscule en octets mais immense en
// pixels ne doit pas saturer la mémoire.
const maxPixelSide = 1024;
const maxInputPixels = 40_000_000;

export type Cutout = (image: Buffer, mimeType: string) => Promise<Buffer>;

// Détourage sur notre serveur (modèle open source embarqué, rien n'est envoyé à un service
// tiers) : la photo d'un joueur, souvent mineur, ne quitte pas EvolyFoot.
export const removeBackgroundCutout: Cutout = async (image) => {
  const { removeBackground } = await import("@imgly/background-removal-node");
  const { default: sharp } = await import("sharp");
  const normalized = await sharp(image, { limitInputPixels: maxInputPixels })
    .rotate()
    .resize(maxPixelSide, maxPixelSide, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
  // Modèles livrés avec le paquet : copiés dans imgly-assets/ par l’image Docker de production
  // (la sortie autonome n’a pas de node_modules au chemin attendu), sinon lus dans node_modules.
  const packageDir = [join(process.cwd(), "imgly-assets"), join(process.cwd(), "node_modules/@imgly/background-removal-node/dist")].find((dir) =>
    existsSync(join(dir, "resources.json")),
  );
  if (!packageDir) {
    throw new Error("Modèles de détourage introuvables.");
  }
  const blob = await removeBackground(new Blob([new Uint8Array(normalized)], { type: "image/png" }), {
    publicPath: `${pathToFileURL(packageDir).href}/`,
    model: "small",
    output: { format: "image/png", quality: 0.9 },
  });
  return Buffer.from(await blob.arrayBuffer());
};

// POST { image: data URL } → { image: data URL PNG sans fond }. Ouvert à tout compte connecté
// (éducateur, adjoint, joueur ou tuteur) : rien n'est enregistré ici, l'appelant choisit ensuite
// de garder la version détourée ou l'originale.
export function createCutoutHandler(
  resolveAccount: (request: Request) => Promise<PublicAccount | null>,
  cutout: Cutout,
  log: (error: unknown) => void,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const account = await resolveAccount(request);
    if (!account) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    const retryAfter = hitRateLimit(`cutout:${account.id}`, cutoutsPerHour, hour);
    if (retryAfter !== null) {
      return Response.json({ error: "Trop de photos d’affilée. Réessaie plus tard." }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
    }
    if (runningCutouts >= maxConcurrentCutouts) {
      return Response.json({ error: "Le détourage est occupé, réessaie dans un instant." }, { status: 503, headers: { "Retry-After": "5" } });
    }
    const body = await request.json().catch(() => null);
    const image = typeof body?.image === "string" ? body.image : "";
    const match = image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match || image.length > maxInputLength) {
      return Response.json({ error: "Image invalide." }, { status: 400 });
    }
    runningCutouts += 1;
    try {
      const png = await cutout(Buffer.from(match[2]!, "base64"), match[1]!);
      return Response.json({ image: `data:image/png;base64,${png.toString("base64")}` });
    } catch (error) {
      log(error);
      return Response.json({ error: "Le détourage a échoué." }, { status: 500 });
    } finally {
      runningCutouts -= 1;
    }
  };
}
