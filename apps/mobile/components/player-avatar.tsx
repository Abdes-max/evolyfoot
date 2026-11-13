import { Image, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

// Photo du joueur si elle est renseignée, sinon ses initiales, dans le rond fourni par `style`.
export function PlayerAvatar({
  name,
  photo,
  style,
  textStyle,
}: {
  name: string;
  photo?: string | null;
  style: StyleProp<ViewStyle>;
  textStyle: StyleProp<TextStyle>;
}) {
  return (
    <View style={[style, { overflow: "hidden" }]}>
      {photo ? (
        <Image accessibilityIgnoresInvertColors resizeMode="cover" source={{ uri: photo }} style={{ width: "100%", height: "100%" }} />
      ) : (
        <Text style={textStyle}>{initials(name)}</Text>
      )}
    </View>
  );
}
