import { ActionSheetIOS, Linking, Platform } from "react-native";

// Ouvre une adresse dans l'appli de cartes ou de GPS que la personne choisit parmi celles
// installées sur son téléphone.
// - Android : le lien `geo:` fait apparaître le sélecteur du système avec toutes les applis
//   capables de l'ouvrir (Google Maps, Waze, Plans, etc.).
// - iOS : pas de sélecteur système, on propose Plans plus chaque appli connue détectée par
//   canOpenURL (schémas déclarés dans LSApplicationQueriesSchemes, voir app.json).
function webUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

const iosApps = [
  { label: "Google Maps", scheme: "comgooglemaps://", url: (query: string) => `comgooglemaps://?q=${query}` },
  { label: "Waze", scheme: "waze://", url: (query: string) => `waze://?q=${query}&navigate=yes` },
  { label: "Citymapper", scheme: "citymapper://", url: (query: string) => `citymapper://directions?endaddress=${query}` },
] as const;

export async function openInMaps(address: string): Promise<void> {
  const query = encodeURIComponent(address.trim());
  if (!query) return;

  if (Platform.OS === "android") {
    await Linking.openURL(`geo:0,0?q=${query}`).catch(() => Linking.openURL(webUrl(query)).catch(() => undefined));
    return;
  }
  if (Platform.OS !== "ios") {
    await Linking.openURL(webUrl(query)).catch(() => undefined);
    return;
  }

  const detected = await Promise.all(iosApps.map(async (app) => ((await Linking.canOpenURL(app.scheme).catch(() => false)) ? app : null)));
  const choices = [{ label: "Plans", url: `maps://?q=${query}` }, ...detected.flatMap((app) => (app ? [{ label: app.label, url: app.url(query) }] : []))];
  if (choices.length === 1) {
    await Linking.openURL(choices[0]!.url).catch(() => Linking.openURL(webUrl(query)).catch(() => undefined));
    return;
  }
  ActionSheetIOS.showActionSheetWithOptions(
    { title: address.trim(), options: [...choices.map((choice) => `Ouvrir dans ${choice.label}`), "Annuler"], cancelButtonIndex: choices.length },
    (index) => {
      const choice = choices[index];
      if (choice) void Linking.openURL(choice.url).catch(() => Linking.openURL(webUrl(query)).catch(() => undefined));
    },
  );
}
