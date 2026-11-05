import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { launchImageLibraryAsync } from "expo-image-picker";

// Même format que la photo posée par l’éducateur dans l’appli Coach (lib/player-photo.ts) : carré,
// 400 px, data URL JPEG — assez de détail pour un détourage net.
const photoMaxSide = 400;

export async function pickPhoto(): Promise<string | null> {
  const picked = await launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 });
  const asset = picked.canceled ? null : picked.assets[0];
  if (!asset) return null;
  const context = ImageManipulator.manipulate(asset.uri);
  context.resize(asset.width >= asset.height ? { width: photoMaxSide } : { height: photoMaxSide });
  const image = await context.renderAsync();
  const result = await image.saveAsync({ base64: true, compress: 0.8, format: SaveFormat.JPEG });
  if (!result.base64) throw new Error("Image vide");
  return `data:image/jpeg;base64,${result.base64}`;
}
