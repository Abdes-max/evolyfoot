import type { AdjustmentSuggestion } from "@evolyfoot/domain";
import { useState } from "react";
import { AccessibilityInfo, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, radii, spacing } from "@evolyfoot/design-tokens";

type Decision = "pending" | "accepted" | "declined";

interface AdjustmentCardProps {
  suggestion: AdjustmentSuggestion;
}

export function AdjustmentCard({ suggestion }: AdjustmentCardProps) {
  const [decision, setDecision] = useState<Decision>("pending");
  const status = decision === "accepted"
    ? "Ajustement appliqué à la prochaine séance"
    : decision === "declined"
      ? "Plan actuel conservé"
      : "";

  function decide(nextDecision: Decision) {
    setDecision(nextDecision);
    if (Platform.OS === "ios" && nextDecision !== "pending") {
      AccessibilityInfo.announceForAccessibility(nextDecision === "accepted"
        ? "Ajustement appliqué à la prochaine séance"
        : "Plan actuel conservé");
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>PROPOSITION POUR LA PROCHAINE SÉANCE</Text>
      <Text accessibilityRole="header" style={styles.title}>{suggestion.title}</Text>

      <View style={styles.detail}>
        <Text style={styles.label}>Pourquoi</Text>
        <Text style={styles.body}>{suggestion.reason}</Text>
      </View>
      <View style={styles.detail}>
        <Text style={styles.label}>Ce qui change</Text>
        <Text style={styles.body}>{`${suggestion.proposedTheme} · ${suggestion.constraint}`}</Text>
        <Text style={styles.body}>{suggestion.impact}</Text>
      </View>
      <View style={styles.detail}>
        <Text style={styles.label}>À observer</Text>
        <Text style={styles.body}>{suggestion.observable}</Text>
      </View>

      {status && <Text accessibilityLiveRegion={Platform.OS === "android" ? "polite" : "none"} style={styles.status}>{status}</Text>}
      <View style={styles.actions}>
        {decision === "pending" && <>
          <TouchableOpacity accessibilityLabel="Appliquer cet ajustement" accessibilityRole="button" hitSlop={8} onPress={() => decide("accepted")} style={[styles.action, styles.apply]}>
            <Text style={styles.applyText}>Appliquer cet ajustement</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityLabel="Garder mon plan" accessibilityRole="button" hitSlop={8} onPress={() => decide("declined")} style={styles.action}>
            <Text style={styles.actionText}>Garder mon plan</Text>
          </TouchableOpacity>
        </>}
        {decision === "accepted" && <TouchableOpacity accessibilityLabel="Annuler" accessibilityRole="button" hitSlop={8} onPress={() => decide("pending")} style={styles.action}>
          <Text style={styles.actionText}>Annuler</Text>
        </TouchableOpacity>}
        {decision === "declined" && <TouchableOpacity accessibilityLabel="Reconsidérer la proposition" accessibilityRole="button" hitSlop={8} onPress={() => decide("pending")} style={styles.action}>
          <Text style={styles.actionText}>Reconsidérer la proposition</Text>
        </TouchableOpacity>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.md, borderWidth: 1, marginTop: 20, padding: spacing.md },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  title: { color: colors.ink, fontSize: 22, fontWeight: "800", lineHeight: 28, marginTop: 8 },
  detail: { marginTop: 16 },
  label: { color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
  body: { color: colors.ink, fontSize: 13, lineHeight: 19, marginTop: 4 },
  status: { color: colors.primary, fontSize: 13, fontWeight: "800", lineHeight: 19, marginTop: 18 },
  actions: { gap: 8, marginTop: 18 },
  action: { alignItems: "center", backgroundColor: colors.paper, borderColor: colors.line, borderRadius: radii.sm, borderWidth: 1, justifyContent: "center", minHeight: 44, minWidth: 44, paddingHorizontal: 14 },
  apply: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionText: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  applyText: { color: colors.primaryInk, fontSize: 12, fontWeight: "800" },
});
