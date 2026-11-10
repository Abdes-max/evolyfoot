import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { launchImageLibraryAsync } from "expo-image-picker";

// Un logo n'a pas besoin de plus de détail : petite image PNG (la transparence est conservée), stockée telle quelle.
const teamLogoMaxSide = 256;

// Ouvre la galerie et renvoie une data URL PNG réduite, ou `null` si le coach annule.
export async function pickTeamLogo(): Promise<string | null> {
  const picked = await launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 });
  const asset = picked.canceled ? null : picked.assets[0];
  if (!asset) {
    return null;
  }
  const context = ImageManipulator.manipulate(asset.uri);
  context.resize(asset.width >= asset.height ? { width: teamLogoMaxSide } : { height: teamLogoMaxSide });
  const image = await context.renderAsync();
  const result = await image.saveAsync({ base64: true, format: SaveFormat.PNG });
  if (!result.base64) {
    throw new Error("Image vide");
  }
  return `data:image/png;base64,${result.base64}`;
}
