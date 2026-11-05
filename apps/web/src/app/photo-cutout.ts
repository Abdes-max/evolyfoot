// Version sans fond d’une photo (data URL), calculée par le serveur (/api/photos/detourage).
// `null` si le détourage échoue : l’appelant garde alors la photo d’origine.
export async function cutoutPhoto(dataUrl: string): Promise<string | null> {
  const response = await fetch("/api/photos/detourage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ image: dataUrl }),
  }).catch(() => null);
  const body = response?.ok ? await response.json().catch(() => null) : null;
  return typeof body?.image === "string" ? body.image : null;
}
