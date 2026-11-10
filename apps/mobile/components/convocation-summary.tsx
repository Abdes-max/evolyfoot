import { colors, spacing } from "@evolyfoot/design-tokens";
import { concernedPlayers, summarizeTrainingResponses, type AttendanceEntry, type PlayerSelection } from "@evolyfoot/domain";
import { StyleSheet, Text, View } from "react-native";

// Convocation d'un événement sur sa carte (match, tournoi, plateau) : envoyée ou non, puis présents, absents
// et sans réponse parmi les joueurs concernés.
export function ConvocationSummary({
  convokedAt,
  attendance,
  selectedPlayerIds,
  roster,
}: {
  convokedAt: string | null | undefined;
  attendance: readonly AttendanceEntry[] | undefined;
  selectedPlayerIds: PlayerSelection | undefined;
  roster: readonly { id: string; name: string }[];
}) {
  if (!convokedAt) {
    return <Text style={styles.pending}>Convocation pas encore envoyée</Text>;
  }
  const responses = summarizeTrainingResponses(concernedPlayers(roster, selectedPlayerIds ?? null), attendance);
  return (
    <View style={styles.wrap}>
      <Text style={styles.sent}>Convocation envoyée le {new Date(convokedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</Text>
      <View style={styles.counts}>
        <Text style={[styles.count, { color: "#3ddc84" }]}>{responses.present.length} présents</Text>
        <Text style={[styles.count, { color: "#ff6b6b" }]}>{responses.absent.length} absents</Text>
        <Text style={[styles.count, { color: "#ffb073" }]}>{responses.pending.length} sans réponse</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, gap: 2 },
  sent: { color: colors.lime, fontSize: 12, fontWeight: "800" },
  pending: { color: colors.muted, fontSize: 12, fontWeight: "800", marginTop: 8 },
  counts: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  count: { fontSize: 12, fontWeight: "800" },
});
