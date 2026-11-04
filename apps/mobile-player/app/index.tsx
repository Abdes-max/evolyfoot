import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { PlayerCard } from "../components/player-card";
import { Screen } from "../components/screen";
import { useAuth } from "../lib/auth-context";
import { buildAgenda, useDashboard } from "../lib/dashboard";
import { markEvaluationsRead } from "../lib/push";

export default function MyCardScreen() {
  const { logout, sessionToken } = useAuth();
  useFocusEffect(
    useCallback(() => {
      if (sessionToken) void markEvaluationsRead(sessionToken);
    }, [sessionToken]),
  );
  const { dashboard, status } = useDashboard();
  const [now] = useState(() => Date.now());

  function confirmLogout() {
    Alert.alert("Mon compte", undefined, [
      { text: "Annuler", style: "cancel" },
      { text: "Se déconnecter", onPress: logout },
      { text: "Supprimer mon compte", style: "destructive", onPress: () => router.push("/compte") },
    ]);
  }

  const latestCoach = dashboard?.evaluations.find((evaluation) => evaluation.source !== "player");
  const agenda = dashboard ? buildAgenda(dashboard, now).slice(0, 3) : [];

  return (
    <Screen
      action={
        <TouchableOpacity accessibilityRole="button" onPress={confirmLogout} style={styles.logout}>
          <Text style={styles.logoutText}>Compte</Text>
        </TouchableOpacity>
      }
      title="Ma carte"
    >
      {status === "loading" && !dashboard ? <Text style={styles.note}>Chargement…</Text> : null}
      {status === "error" && !dashboard ? <Text style={styles.note}>Impossible de charger ta carte. Vérifie ta connexion.</Text> : null}

      {dashboard ? (
        <>
          {dashboard.team ? (
            <Text style={styles.team}>
              {dashboard.team.name} · {dashboard.team.ageGroup}
            </Text>
          ) : null}
          <PlayerCard
            jerseyNumber={dashboard.player.jerseyNumber}
            name={dashboard.player.name}
            photo={dashboard.player.photo}
            position={dashboard.player.position}
            preferredFoot={dashboard.player.preferredFoot}
            scores={latestCoach?.scores ?? null}
            season={dashboard.season}
          />

          <Text style={styles.section}>À venir</Text>
          {agenda.length === 0 ? <Text style={styles.note}>Rien de prévu pour l’instant.</Text> : null}
          {agenda.map((event) => (
            <View key={event.key} style={styles.event}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.eventMeta}>{[event.dateLabel, event.time, event.location].filter(Boolean).join(" · ")}</Text>
            </View>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  logout: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line },
  logoutText: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  note: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  team: { color: colors.lime, fontSize: 13, fontWeight: "800", textAlign: "center", marginBottom: spacing.sm },
  section: { color: colors.ink, fontSize: 22, fontWeight: "900", textTransform: "uppercase", marginTop: spacing.lg, marginBottom: spacing.sm },
  event: {
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    backgroundColor: colors.surface,
  },
  eventTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  eventMeta: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
});
