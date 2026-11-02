import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { buildSeasonCalendar, buildSeasonPlan, currentCycleWeek, type SeasonEventInput, type SeasonEventType } from "@evolyfoot/domain";
import { Link, router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth, type SeasonData } from "../lib/auth-context";

const typeLabels: Record<SeasonEventType, string> = {
  session: "Séance",
  match: "Match",
  tournament: "Tournoi",
  plateau: "Plateau",
};

function monthLabel(year: number, month: number): string {
  const label = new Date(year, month, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
}

function shortDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function EventRow({ event }: { event: SeasonEventInput & { date: string } }) {
  const content = (
    <>
      <Text style={styles.eventDay}>{dayLabel(event.date)}</Text>
      <View style={styles.eventBody}>
        <Text numberOfLines={1} style={styles.eventTitle}>
          {event.title}
        </Text>
        <Text style={[styles.eventType, event.type === "match" && styles.eventTypeMatch]}>{typeLabels[event.type]}</Text>
      </View>
    </>
  );
  // Seuls les matchs ont un écran de détail sur l'application pour l'instant.
  if (event.type === "match") {
    return (
      <TouchableOpacity accessibilityRole="button" onPress={() => router.push(`/match/${event.id}`)} style={styles.event}>
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={styles.event}>{content}</View>;
}

export default function SaisonScreen() {
  const { diagnosticScores, team, loadSeason } = useAuth();
  const [season, setSeason] = useState<SeasonData | null>(null);
  const [now] = useState(() => new Date());

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadSeason().then((data) => {
        if (!cancelled) {
          setSeason(data);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [loadSeason]),
  );

  const calendar = useMemo(() => buildSeasonCalendar(season?.events ?? [], now), [season, now]);
  const cycles = useMemo(() => {
    if (!season || !diagnosticScores) {
      return [];
    }
    const activeWeek = currentCycleWeek(season.cycleSessions, team?.trainingDays.length ?? 1);
    return buildSeasonPlan(diagnosticScores, season.cycleNumber, activeWeek, now);
  }, [season, diagnosticScores, team, now]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.back()}>
          <Text style={styles.back}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.step}>{calendar.label.toUpperCase()}</Text>
        <Text style={styles.title}>Toute ta saison, mois par mois.</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Le plan de ta saison</Text>
          {diagnosticScores ? (
            <>
              <Text style={styles.muted}>Tes priorités reviennent à tour de rôle jusqu’en juin. Ce plan se met à jour à chaque nouveau diagnostic.</Text>
              {cycles.map((cycle) => (
                <View key={cycle.number} style={[styles.cycle, cycle.current && styles.cycleCurrent]}>
                  <Text style={styles.cycleLabel}>
                    CYCLE {cycle.number}
                    {cycle.current ? " · EN COURS" : ""} · {shortDate(cycle.start)} – {shortDate(cycle.end)}
                  </Text>
                  <Text style={styles.cycleTheme}>{cycle.theme}</Text>
                  <Text style={styles.muted}>{cycle.intent}</Text>
                  <Text style={styles.muted}>En soutien : {cycle.supportTheme}</Text>
                </View>
              ))}
            </>
          ) : (
            <Link asChild href="/diagnostic">
              <TouchableOpacity accessibilityRole="button">
                <Text style={styles.link}>Fais ton diagnostic pour obtenir le plan de ta saison →</Text>
              </TouchableOpacity>
            </Link>
          )}
        </View>

        {season === null && <Text style={styles.muted}>Chargement…</Text>}
        {season?.failed && <Text style={styles.error}>La saison n’a pas pu être chargée entièrement.</Text>}
        {calendar.undatedCount > 0 && (
          <Text style={styles.muted}>
            {calendar.undatedCount} événement{calendar.undatedCount > 1 ? "s" : ""} sans date réelle n’apparaît pas ici.
          </Text>
        )}
        {season &&
          calendar.months.map((month) => (
            <View key={month.key} style={[styles.card, month.isCurrent && styles.monthCurrent]}>
              <Text style={styles.cardTitle}>{monthLabel(month.year, month.month)}</Text>
              {month.events.length === 0 ? (
                <Text style={styles.muted}>Rien de prévu.</Text>
              ) : (
                month.events.map((event) => <EventRow event={event} key={`${event.type}-${event.id}`} />)
              )}
            </View>
          ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  page: { padding: spacing.lg, paddingBottom: 48 },
  back: { fontSize: 12, fontWeight: "800", color: colors.primary, marginBottom: 14 },
  step: { fontSize: 10, fontWeight: "800", color: colors.primary, letterSpacing: 1.1 },
  title: { fontSize: 28, fontWeight: "800", color: colors.ink, marginTop: 10, marginBottom: 20 },
  card: { padding: spacing.md, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, marginBottom: 12 },
  monthCurrent: { borderColor: colors.primary },
  cardTitle: { fontSize: 15, fontWeight: "800", color: colors.ink, marginBottom: 6 },
  muted: { fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: 3 },
  error: { fontSize: 11, fontWeight: "700", color: colors.danger, marginBottom: 10 },
  link: { fontSize: 12, fontWeight: "800", color: colors.primary },
  cycle: { padding: 10, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line, marginTop: 8 },
  cycleCurrent: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  cycleLabel: { fontSize: 9, fontWeight: "800", color: colors.primary, letterSpacing: 0.6 },
  cycleTheme: { fontSize: 13, fontWeight: "800", color: colors.ink, marginTop: 4 },
  event: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.line },
  eventDay: { width: 52, fontSize: 11, fontWeight: "800", color: colors.muted },
  eventBody: { flex: 1 },
  eventTitle: { fontSize: 13, fontWeight: "700", color: colors.ink },
  eventType: { fontSize: 10, fontWeight: "800", color: colors.primary, marginTop: 2 },
  eventTypeMatch: { color: colors.ink },
});
