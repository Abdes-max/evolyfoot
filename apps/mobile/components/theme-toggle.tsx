import { colors, radii } from "@evolyfoot/design-tokens";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../lib/theme";

// Bouton à bascule sombre / clair : pastille qui glisse dans une piste, lune (sombre) ou soleil (clair).
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const light = theme === "light";
  return (
    <TouchableOpacity
      accessibilityLabel={light ? "Passer au thème sombre" : "Passer au thème clair"}
      accessibilityRole="switch"
      accessibilityState={{ checked: light }}
      hitSlop={8}
      onPress={toggleTheme}
      style={[styles.track, { backgroundColor: colors.surface, borderColor: colors.line }]}
    >
      <View style={[styles.knob, { backgroundColor: colors.paper, left: light ? 26 : 2 }]}>
        <Text style={{ color: colors.primary, fontSize: 13, lineHeight: 16 }}>{light ? "☀" : "☾"}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  track: { width: 52, height: 28, borderRadius: radii.pill, borderWidth: 1, justifyContent: "center" },
  knob: { position: "absolute", top: 2, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
});
