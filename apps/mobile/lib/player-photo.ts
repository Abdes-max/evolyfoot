import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { launchImageLibraryAsync } from "expo-image-picker";

// Même côté maximal que la fiche joueur du web : la photo reste une petite data URL stockée
// telle quelle, sous le plafond de taille du serveur.
const playerPhotoMaxSide = 320;

// Ouvre la galerie, recadre au carré et renvoie une data URL JPEG, ou `null` si l'éducateur annule.
export async function pickPlayerPhoto(): Promise<string | null> {
  const picked = await launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 });
  const asset = picked.canceled ? null : picked.assets[0];
  if (!asset) {
    return null;
  }
  const context = ImageManipulator.manipulate(asset.uri);
  context.resize(asset.width >= asset.height ? { width: playerPhotoMaxSide } : { height: playerPhotoMaxSide });
  const image = await context.renderAsync();
  const result = await image.saveAsync({ base64: true, compress: 0.8, format: SaveFormat.JPEG });
  if (!result.base64) {
    throw new Error("Image vide");
  }
  return `data:image/jpeg;base64,${result.base64}`;
}

// La saisie se fait au format français (JJ/MM/AAAA), l'API attend AAAA-MM-JJ.
export function birthDateToIso(value: string): string | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!match) {
    return undefined;
  }
  const [, day, month, year] = match;
  const iso = `${year}-${month!.padStart(2, "0")}-${day!.padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso ? undefined : iso;
}

export function birthDateFromIso(iso: string | null): string {
  if (!iso) {
    return "";
  }
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}
