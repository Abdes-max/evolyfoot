import { colors } from "@evolyfoot/design-tokens";
import { Image, StyleSheet, Text, View } from "react-native";

// Logo de l'équipe, ou ses initiales tant qu'aucun logo n'a été choisi.
export function TeamCrest({ name, logo, size = 40 }: { name: string; logo?: string | null; size?: number }) {
  const initials =
    (name ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("") || "?";
  return (
    <View style={[styles.crest, { width: size, height: size, borderRadius: size / 2 }]}>
      {logo ? (
        <Image accessibilityLabel={`Logo ${name}`} resizeMode="contain" source={{ uri: logo }} style={{ width: size - 6, height: size - 6 }} />
      ) : (
        <Text style={[styles.initials, { fontSize: Math.round(size * 0.36) }]}>{initials}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  crest: { alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.paper },
  initials: { color: colors.primary, fontWeight: "900" },
});
