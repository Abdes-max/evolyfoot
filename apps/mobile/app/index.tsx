import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import {
  buildDevelopmentPlan,
  currentCycleWeek,
  firstFreeCycleSlot,
  summarizeDiagnostic,
  trainingCycleWeekCount,
  type SavedTrainingSession,
} from "@evolyfoot/domain";
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Link, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useAuth } from "../lib/auth-context";

function initials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

function sessionDuration(session: SavedTrainingSession): number {
  return session.blocks.reduce((total, block) => total + block.durationMinutes, 0);
}

function meetingLabel(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

export default function HomeScreen() {
  const { educator, team, diagnosticScores, listSessions, logout } = useAuth();
  const [sessions, setSessions] = useState<readonly SavedTrainingSession[]>([]);
  const [now] = useState(() => Date.now());
  const firstName = educator?.displayName.split(" ")[0] ?? "";
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }).toUpperCase();

  // Relu à chaque retour sur l'accueil : une séance vient peut-être d'être validée.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listSessions().then((list) => {
        if (!cancelled) {
          setSessions(list);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [listSessions]),
  );

  const slotsPerWeek = Math.max(team?.trainingDays.length ?? 1, 1);
  const activeWeek = currentCycleWeek(sessions, slotsPerWeek);
  const plan = diagnosticScores ? buildDevelopmentPlan(summarizeDiagnostic(diagnosticScores)) : null;
  const week = plan?.weeks[activeWeek - 1];
  const totalSlots = slotsPerWeek * trainingCycleWeekCount;
  const progress = Math.round((Math.min(sessions.length, totalSlots) / totalSlots) * 100);
  const upcoming = [...sessions]
    .filter((session) => session.meetingAt && new Date(session.meetingAt).getTime() >= now)
    .sort((a, b) => new Date(a.meetingAt!).getTime() - new Date(b.meetingAt!).getTime())[0];
  const freeSlot = firstFreeCycleSlot(sessions, slotsPerWeek);
  const target = upcoming ?? freeSlot ?? { weekNumber: activeWeek, slot: 0 };

  function confirmLogout() {
    Alert.alert("Mon compte", undefined, [
      { text: "Annuler", style: "cancel" },
      { text: "Mon profil", onPress: () => router.push("/profil") },
      { text: "Se déconnecter", onPress: logout },
      { text: "Supprimer mon compte", style: "destructive", onPress: () => router.push("/compte") },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{today}</Text>
            <Text style={styles.title}>Bonjour {firstName},</Text>
            <Text style={styles.subtitle}>{team ? `${team.name} · ${team.ageGroup}` : "Pas encore d’équipe"}</Text>
          </View>
          <TouchableOpacity accessibilityLabel="Mon compte" onPress={confirmLogout} style={styles.avatar}>
            <Text style={styles.avatarText}>{educator ? initials(educator.displayName) : "?"}</Text>
          </TouchableOpacity>
        </View>

        {plan && week ? (
          <View style={styles.focusCard}>
            <Text style={styles.focusEyebrow}>
              PRIORITÉ DU CYCLE · SEMAINE {activeWeek}/{trainingCycleWeekCount}
            </Text>
            <Text style={styles.focusTitle}>{week.theme}</Text>
            <Text style={styles.focusBody}>{week.intention}</Text>
            <View style={styles.progress}>
              <View style={[styles.progressValue, { width: `${progress}%` }]} />
            </View>
            <View style={styles.row}>
              <Text style={styles.focusMeta}>
                {Math.min(sessions.length, totalSlots)}/{totalSlots} séances
              </Text>
              <Text style={styles.focusMeta}>{progress}%</Text>
            </View>
          </View>
        ) : (
          <Link href="/diagnostic" asChild>
            <TouchableOpacity accessibilityRole="button" style={styles.focusCard}>
              <Text style={styles.focusEyebrow}>POUR COMMENCER</Text>
              <Text style={styles.focusTitle}>Fais ton diagnostic</Text>
              <Text style={styles.focusBody}>Il choisit les priorités de ton cycle de quatre semaines.</Text>
            </TouchableOpacity>
          </Link>
        )}

        <Text style={styles.sectionTitle}>Prochaine séance</Text>
        <View style={styles.sessionCard}>
          {upcoming?.meetingAt ? (
            <>
              <Text style={styles.eyebrow}>{meetingLabel(upcoming.meetingAt).toUpperCase()}</Text>
              <Text style={styles.cardTitle}>{upcoming.title}</Text>
              <Text style={styles.cardBody}>
                {sessionDuration(upcoming)} min · {upcoming.playerCount} joueurs · {upcoming.theme}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.eyebrow}>À GÉNÉRER</Text>
              <Text style={styles.cardTitle}>Ta prochaine séance t’attend</Text>
              <Text style={styles.cardBody}>Une séance prête en un geste, à partir de ton plan.</Text>
            </>
          )}
          <Link href={`/session?week=${target.weekNumber}&slot=${target.slot}`} asChild>
            <TouchableOpacity accessibilityRole="button" style={styles.button}>
              <Text style={styles.buttonText}>{upcoming ? "Ouvrir la séance" : "Générer ma séance"}</Text>
              <Text style={styles.buttonText}>→</Text>
            </TouchableOpacity>
          </Link>
        </View>

        <Link href={`/observation?type=training&week=${activeWeek}`} asChild>
          <TouchableOpacity accessibilityRole="button" style={styles.observationButton}>
            <Text style={styles.observationText}>Observer ma séance</Text>
            <Text style={styles.observationText}>→</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/observations" asChild>
          <TouchableOpacity accessibilityRole="button" style={styles.observationButton}>
            <Text style={styles.observationText}>Mes observations</Text>
            <Text style={styles.observationText}>→</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/bibliotheque" asChild>
          <TouchableOpacity accessibilityRole="button" style={styles.observationButton}>
            <Text style={styles.observationText}>Bibliothèque d’exercices</Text>
            <Text style={styles.observationText}>→</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/seances" asChild>
          <TouchableOpacity accessibilityRole="button" style={styles.observationButton}>
            <Text style={styles.observationText}>Toutes mes séances</Text>
            <Text style={styles.observationText}>→</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/saison" asChild>
          <TouchableOpacity accessibilityRole="button" style={styles.observationButton}>
            <Text style={styles.observationText}>Ma saison</Text>
            <Text style={styles.observationText}>→</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/statistiques" asChild>
          <TouchableOpacity accessibilityRole="button" style={styles.observationButton}>
            <Text style={styles.observationText}>Statistiques</Text>
            <Text style={styles.observationText}>→</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/match" asChild>
          <TouchableOpacity accessibilityRole="button" style={styles.observationButton}>
            <Text style={styles.observationText}>Préparer un match</Text>
            <Text style={styles.observationText}>→</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/onboarding" asChild>
          <TouchableOpacity style={styles.setupButton}>
            <Text style={styles.setupText}>{team ? "Modifier mon équipe" : "Configurer mon équipe"}</Text>
            <Text style={styles.setupText}>→</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/equipe" asChild>
          <TouchableOpacity style={styles.setupButton}>
            <Text style={styles.setupText}>Gérer l’effectif</Text>
            <Text style={styles.setupText}>→</Text>
          </TouchableOpacity>
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  page: { padding: spacing.lg, paddingBottom: 48 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xl },
  eyebrow: { fontSize: 10, letterSpacing: 1.2, fontWeight: "800", color: colors.muted },
  title: { fontSize: 28, fontWeight: "800", color: colors.ink, marginTop: 6 },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 4 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.primary, fontSize: 11, fontWeight: "800" },
  focusCard: { padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.primaryDark, borderWidth: 1, borderColor: colors.line },
  focusEyebrow: { fontSize: 9, letterSpacing: 1, color: colors.muted, fontWeight: "800" },
  focusTitle: { fontSize: 23, lineHeight: 29, fontWeight: "800", color: colors.ink, marginTop: 24 },
  focusBody: { fontSize: 12, lineHeight: 19, color: colors.muted, marginTop: 10 },
  progress: { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,.08)", marginTop: 24, overflow: "hidden" },
  progressValue: { height: 6, backgroundColor: colors.primary, borderRadius: 3 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  focusMeta: { fontSize: 10, color: colors.muted, marginTop: 10 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.ink, marginTop: 32, marginBottom: 14 },
  sessionCard: { padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line },
  chip: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: radii.pill,
  },
  cardTitle: { fontSize: 20, fontWeight: "800", color: colors.ink, marginTop: 20 },
  cardBody: { fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 8 },
  button: {
    minHeight: 44,
    marginTop: 22,
    padding: 14,
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  buttonText: { fontSize: 11, fontWeight: "800", color: colors.primaryInk },
  observationButton: {
    minHeight: 44,
    marginTop: 16,
    padding: 14,
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: radii.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  observationText: { fontSize: 11, fontWeight: "800", color: colors.primary },
  suggestion: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    borderRadius: radii.md,
    marginTop: 16,
  },
  suggestionContent: { flex: 1 },
  suggestionTitle: { fontSize: 14, fontWeight: "800", color: colors.ink, marginTop: 5 },
  setupButton: {
    minHeight: 44,
    marginTop: 16,
    padding: 15,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  setupText: { color: colors.ink, fontSize: 11, fontWeight: "800" },
});
