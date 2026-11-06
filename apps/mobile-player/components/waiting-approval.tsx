import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { StyleSheet, Text, View } from "react-native";

// Compte dont aucune demande de suivi n'est encore acceptée par l'éducateur : rien à montrer de
// l'enfant d'ici là (même message que le web, waiting-approval.tsx).
export function WaitingApproval() {
  return (
    <View accessibilityRole="summary" style={styles.card}>
      <Text style={styles.title}>En attente de validation</Text>
      <Text style={styles.body}>
        Ton compte est créé. L’éducateur doit accepter ta demande pour que tu voies le suivi de l’enfant : reviens un peu plus tard.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surface },
  title: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  body: { color: colors.muted, fontSize: 14, lineHeight: 20 },
});
