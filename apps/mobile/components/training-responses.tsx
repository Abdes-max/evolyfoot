import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { attendanceStatusLabels, attendanceStatusOf, summarizeTrainingResponses, type AttendanceEntry, type ResponsePlayer } from "@evolyfoot/domain";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Tab = "present" | "absent" | "pending";

const tabLabels: Record<Tab, string> = { present: "Présents", absent: "Absents", pending: "Sans réponse" };
const tabColors: Record<Tab, string> = { present: "#3ddc84", absent: "#ff6b6b", pending: "#ffb073" };

// Réponses à la convocation d'un entraînement, à la manière de Spond (même écran que le web,
// training-responses.tsx) : trois compteurs, chacun ouvrant la liste des joueurs.
export function TrainingResponses({
  roster,
  attendance,
  convokedAt,
}: {
  roster: readonly ResponsePlayer[];
  attendance: readonly AttendanceEntry[] | undefined;
  convokedAt: string | null;
}) {
  const [tab, setTab] = useState<Tab | null>(null);

  if (!convokedAt) {
    return (
      <View style={styles.scheduled}>
        <Text style={styles.badge}>Programmée</Text>
        <Text style={styles.hint}>Les joueurs voient la séance sans pouvoir répondre tant que la convocation n’est pas envoyée.</Text>
      </View>
    );
  }

  const responses = summarizeTrainingResponses(roster, attendance);
  const counts: Record<Tab, number> = { present: responses.present.length, absent: responses.absent.length, pending: responses.pending.length };
  const rows =
    tab === null
      ? []
      : tab === "pending"
        ? responses.pending.map((player) => ({ id: player.id, name: player.name, detail: "Pas encore répondu" }))
        : responses[tab].map((entry) => ({
            id: entry.playerId,
            name: entry.playerName,
            detail: `${entry.byDefault ? "Présent par défaut" : attendanceStatusLabels[attendanceStatusOf(entry)]}${entry.comment ? ` · « ${entry.comment} »` : ""}`,
          }));

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>
        Convocation envoyée le {new Date(convokedAt).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
      </Text>
      <View style={styles.counts}>
        {(Object.keys(tabLabels) as Tab[]).map((key) => (
          <TouchableOpacity
            accessibilityLabel={`${counts[key]} ${tabLabels[key]}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            key={key}
            onPress={() => setTab(tab === key ? null : key)}
            style={[styles.count, tab === key && styles.countActive]}
          >
            <Text style={[styles.countValue, { color: tabColors[key] }]}>{counts[key]}</Text>
            <Text style={styles.countLabel}>{tabLabels[key]}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab !== null &&
        (rows.length === 0 ? (
          <Text style={styles.hint}>Personne pour l’instant.</Text>
        ) : (
          rows.map((row) => (
            <View key={row.id} style={styles.row}>
              <View style={styles.avatar}>
                <Text style={[styles.avatarText, { color: tabColors[tab] }]}>{row.name.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{row.name}</Text>
                <Text style={styles.hint}>{row.detail}</Text>
              </View>
            </View>
          ))
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, marginVertical: spacing.sm },
  scheduled: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginVertical: spacing.sm },
  badge: {
    overflow: "hidden",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.paper,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  hint: { flexShrink: 1, color: colors.muted, fontSize: 12.5 },
  counts: { flexDirection: "row", gap: spacing.sm },
  count: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
  },
  countActive: { borderColor: colors.primary },
  countValue: { fontSize: 22, fontWeight: "900" },
  countLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radii.md, backgroundColor: colors.paper },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  avatarText: { fontWeight: "900" },
  name: { color: colors.ink, fontSize: 14, fontWeight: "800" },
});
