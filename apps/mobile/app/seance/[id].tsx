import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { rehydrateTrainingSession, seasonSessionStatus, seasonSessionStatusLabels, type SavedTrainingSession, type TrainingSession } from "@evolyfoot/domain";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CancelEventPanel } from "../../components/cancel-event-panel";
import { TacticalPlayer } from "../../components/tactical-player";
import { useAuth } from "../../lib/auth-context";
import { kindLabels } from "../../lib/exercise-labels";
import { themedStyles } from "../../lib/themed-styles";

interface Detail {
  session: TrainingSession;
  meetingAt: string | null;
  location: string | null;
  cancelledAt: string | null;
  cancellationNote: string | null;
}

function meetingLabel(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} à ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

// Détail d'une séance préparée : statut, rendez-vous et situations avec leur animation, comme pendant la préparation.
// Le mode chronomètre se lance d'ici, plutôt que d'ouvrir directement le terrain.
export default function SeanceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { apiRequest, listPersonalExercises } = useAuth();
  const [detail, setDetail] = useState<Detail | null | undefined>(undefined);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [response, personal] = await Promise.all([apiRequest(`/api/sessions/${encodeURIComponent(id)}`), listPersonalExercises()]);
      const body = response?.ok ? await response.json().catch(() => null) : null;
      if (cancelled) return;
      const record: (SavedTrainingSession & { cancelledAt?: string | null; cancellationNote?: string | null }) | null = body?.session ?? null;
      const session = record ? rehydrateTrainingSession(record, personal) : null;
      setDetail(
        record && session
          ? {
              session,
              meetingAt: record.meetingAt ?? null,
              location: record.location ?? null,
              cancelledAt: record.cancelledAt ?? null,
              cancellationNote: record.cancellationNote ?? null,
            }
          : null,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [apiRequest, listPersonalExercises, id]);

  if (detail === undefined) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.muted}>Chargement de la séance…</Text>
      </SafeAreaView>
    );
  }
  if (!detail) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.page}>
          <Text style={styles.muted}>Cette séance est introuvable.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { session } = detail;
  const total = session.blocks.reduce((sum, block) => sum + block.durationMinutes, 0);
  const statusLabel = detail.cancelledAt ? "Annulée" : seasonSessionStatusLabels[seasonSessionStatus({ meetingAt: detail.meetingAt }, now)];
  const done = !detail.cancelledAt && seasonSessionStatus({ meetingAt: detail.meetingAt }, now) === "done";

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.statusRow}>
          <Text style={styles.step}>SÉANCE</Text>
          <Text style={[styles.status, detail.cancelledAt ? styles.statusCancelled : done ? styles.statusDone : styles.statusPrepared]}>
            {statusLabel.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.title}>{session.title}</Text>
        <Text style={styles.muted}>
          {[detail.meetingAt ? meetingLabel(detail.meetingAt) : null, detail.location, `${total} min`].filter(Boolean).join(" · ")}
        </Text>
        {detail.cancelledAt ? (
          <Text style={styles.cancelled}>{`Entraînement annulé${detail.cancellationNote ? ` : ${detail.cancellationNote}` : ""}.`}</Text>
        ) : null}

        <TouchableOpacity accessibilityRole="button" onPress={() => router.push(`/terrain/${id}` as never)} style={styles.primary}>
          <Text style={styles.primaryText}>Lancer le mode chronomètre</Text>
        </TouchableOpacity>

        {session.blocks.map((block, index) => (
          <View key={block.id} style={styles.card}>
            <Text style={styles.label}>
              {index + 1}. {kindLabels[block.activity.kind].toUpperCase()} · {block.durationMinutes} MIN
            </Text>
            <Text style={styles.cardTitle}>{block.activity.title}</Text>
            {block.activity.photo ? null : (
              <TacticalPlayer exercise={block.activity} label={`Schéma tactique animé : ${block.activity.title}`} seed={block.activity.id} />
            )}
            <Text style={styles.body}>{block.activity.instruction}</Text>
            {block.activity.rules.map((rule) => (
              <Text key={rule} style={styles.muted}>
                • {rule}
              </Text>
            ))}
          </View>
        ))}

        <CancelEventPanel
          cancellationNote={detail.cancellationNote}
          cancelledAt={detail.cancelledAt}
          noun="cette séance"
          onChange={(state) => setDetail((current) => (current ? { ...current, ...state } : current))}
          url={`/api/sessions/${encodeURIComponent(id)}/cancel`}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.paper },
    page: { padding: spacing.lg, paddingBottom: 48, gap: 6 },
    statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    step: { fontSize: 10, fontWeight: "800", color: colors.primary, letterSpacing: 1.1 },
    status: {
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 0.8,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: radii.pill,
      borderWidth: 1,
      overflow: "hidden",
    },
    statusPrepared: { color: colors.primary, borderColor: colors.primary },
    statusDone: { color: colors.lime, borderColor: colors.lime },
    statusCancelled: { color: colors.danger, borderColor: colors.danger },
    title: { fontSize: 24, fontWeight: "800", color: colors.ink, marginTop: 6 },
    muted: { fontSize: 12, lineHeight: 17, color: colors.muted },
    cancelled: { color: colors.danger, fontSize: 13, fontWeight: "800", marginTop: 4 },
    primary: {
      minHeight: 52,
      marginVertical: spacing.md,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.sm,
      backgroundColor: colors.primary,
    },
    primaryText: { fontSize: 15, fontWeight: "800", color: colors.primaryInk },
    card: { padding: spacing.md, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, marginBottom: 12, gap: 6 },
    label: { fontSize: 10, fontWeight: "800", color: colors.primary, letterSpacing: 0.6 },
    cardTitle: { fontSize: 15, fontWeight: "800", color: colors.ink },
    body: { fontSize: 13, lineHeight: 19, color: colors.ink },
  }),
);
