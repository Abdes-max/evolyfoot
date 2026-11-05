import { resolveAccountFromRequest } from "@/server/auth";
import { createCutoutHandler, removeBackgroundCutout } from "@/server/photo-cutout";

// Le modèle tourne sur le serveur Node (onnxruntime), jamais en périphérie.
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return createCutoutHandler(resolveAccountFromRequest, removeBackgroundCutout, console.error)(request);
}
