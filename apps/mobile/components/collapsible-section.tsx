import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { useState, type ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from "react-native";
import { themedStyles } from "../lib/themed-styles";

// Section repliable : titre et résumé toujours visibles, contenu au toucher. Repliée par défaut.
export function CollapsibleSection({
  title,
  summary,
  defaultOpen = false,
  style,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={[styles.card, style]}>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {summary ? <Text style={styles.summary}>{summary}</Text> : null}
        </View>
        <Text style={styles.chevron}>{open ? "▾" : "▸"}</Text>
      </TouchableOpacity>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    card: { borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: "hidden" },
    head: { flexDirection: "row", alignItems: "center", padding: spacing.md },
    title: { color: colors.ink, fontSize: 15, fontWeight: "800" },
    summary: { color: colors.muted, fontSize: 12, marginTop: 2 },
    chevron: { color: colors.muted, fontSize: 18, paddingLeft: spacing.sm },
    body: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  }),
);
