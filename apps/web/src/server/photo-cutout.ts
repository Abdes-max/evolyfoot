import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { PublicAccount } from "./auth";

// Taille maximale de la photo reçue (data URL) : l'appli la redimensionne déjà avant l'envoi.
const maxInputLength = 3_000_000;

export type Cutout = (image: Buffer, mimeType: string) => Promise<Buffer>;

// Détourage sur notre serveur (modèle open source embarqué, rien n'est envoyé à un service
// tiers) : la photo d'un joueur, souvent mineur, ne quitte pas EvolyFoot.
export const removeBackgroundCutout: Cutout = async (image, mimeType) => {
  const { removeBackground } = await import("@imgly/background-removal-node");
  // Modèles livrés avec le paquet : copiés dans imgly-assets/ par l’image Docker de production
  // (la sortie autonome n’a pas de node_modules au chemin attendu), sinon lus dans node_modules.
  const packageDir = [join(process.cwd(), "imgly-assets"), join(process.cwd(), "node_modules/@imgly/background-removal-node/dist")].find((dir) =>
    existsSync(join(dir, "resources.json")),
  );
  if (!packageDir) {
    throw new Error("Modèles de détourage introuvables.");
  }
  const blob = await removeBackground(new Blob([new Uint8Array(image)], { type: mimeType }), {
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
    if (!(await resolveAccount(request))) {
      return Response.json({ error: "Authentification requise." }, { status: 401 });
    }
    const body = await request.json().catch(() => null);
    const image = typeof body?.image === "string" ? body.image : "";
    const match = image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match || image.length > maxInputLength) {
      return Response.json({ error: "Image invalide." }, { status: 400 });
    }
    try {
      const png = await cutout(Buffer.from(match[2]!, "base64"), match[1]!);
      return Response.json({ image: `data:image/png;base64,${png.toString("base64")}` });
    } catch (error) {
      log(error);
      return Response.json({ error: "Le détourage a échoué." }, { status: 500 });
    }
  };
}
