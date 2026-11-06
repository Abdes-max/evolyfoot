import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import {
  buildPrioritizedSeason,
  buildSeasonCalendar,
  buildSeasonPlan,
  currentCycleWeek,
  seasonSlotDate,
  type DevelopmentTheme,
  type SeasonEventInput,
  type SeasonEventType,
} from "@evolyfoot/domain";
import { Link, router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GuidedSeason, slotLabel } from "../components/guided-season";
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

// Événement du calendrier : une séance de la saison guidée pas encore préparée est « à préparer »
// et ouvre sa fiche (même principe que le web, saison-view.tsx).
interface CalendarEvent extends SeasonEventInput {
  planned?: { sessionNumber: number; week: number; slot: number };
}

const typeColors: Record<SeasonEventType, string> = {
  session: colors.primary,
  match: colors.lime,
  tournament: "#ffb073",
  plateau: "#c084fc",
};

const weekdayHeaders = ["L", "M", "M", "J", "V", "S", "D"];

// Cases du mois, lundi en premier : `null` pour les jours du mois précédent.
function monthCells(year: number, month: number): (number | null)[] {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  return [...Array<null>(offset).fill(null), ...Array.from({ length: days }, (_, index) => index + 1)];
}

function openEvent(event: CalendarEvent) {
  if (event.planned) {
    router.push({
      pathname: "/saison/seance/[number]",
      params: { number: String(event.planned.sessionNumber), semaine: String(event.planned.week), creneau: String(event.planned.slot) },
    });
  } else if (event.type === "match") {
    router.push(`/match/${event.id}`);
  } else if (event.type === "tournament" || event.type === "plateau") {
    router.push({ pathname: "/competition/[id]", params: { id: event.id, kind: event.type } });
  }
}

function EventRow({ event }: { event: CalendarEvent & { date: string } }) {
  const clickable = Boolean(event.planned) || event.type !== "session";
  const content = (
    <>
      <Text style={styles.eventDay}>{dayLabel(event.date)}</Text>
      <View style={[styles.eventDot, { backgroundColor: typeColors[event.type] }, event.planned && styles.eventDotPlanned]} />
      <View style={styles.eventBody}>
        <Text numberOfLines={1} style={[styles.eventTitle, event.planned && styles.eventTitlePlanned]}>
          {event.title}
        </Text>
        <Text style={[styles.eventType, { color: typeColors[event.type] }]}>{event.planned ? "Séance à préparer" : typeLabels[event.type]}</Text>
      </View>
    </>
  );
  if (clickable) {
    return (
      <TouchableOpacity accessibilityRole="button" onPress={() => openEvent(event)} style={styles.event}>
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={styles.event}>{content}</View>;
}

// Grille du mois (lundi → dimanche) : un point de couleur par événement du jour, le jour même cerclé.
function MonthGrid({ year, month, events, now }: { year: number; month: number; events: readonly (CalendarEvent & { date: string })[]; now: Date }) {
  return (
    <View style={styles.grid}>
      {weekdayHeaders.map((label, index) => (
        <Text key={index} style={styles.gridHeader}>
          {label}
        </Text>
      ))}
      {monthCells(year, month).map((day, index) => {
        const dayEvents = day === null ? [] : events.filter((event) => new Date(event.date).getDate() === day);
        const today = day !== null && now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;
        return (
          <View key={index} style={styles.gridCell}>
            {day !== null ? (
              <>
                <Text style={[styles.gridDay, today && styles.gridToday]}>{day}</Text>
                <View style={styles.gridDots}>
                  {dayEvents.slice(0, 3).map((event) => (
                    <View
                      key={`${event.type}-${event.id}`}
                      style={[styles.gridDot, { backgroundColor: typeColors[event.type] }, event.planned && styles.eventDotPlanned]}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export default function SaisonScreen() {
  const { diagnosticScores, team, loadSeason, apiRequest } = useAuth();
  const [season, setSeason] = useState<SeasonData | null>(null);
  const [now] = useState(() => new Date());
  const [program, setProgram] = useState<{ priorities: DevelopmentTheme[]; startDate: string } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([loadSeason(), apiRequest("/api/season-program")]).then(async ([data, programResponse]) => {
        const body = programResponse?.ok ? await programResponse.json().catch(() => null) : null;
        if (!cancelled) {
          setSeason(data);
          setProgram(body?.program ?? null);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [loadSeason, apiRequest]),
  );

  // Séances de la saison guidée pas encore préparées, placées à leur date proposée.
  const planned = useMemo((): CalendarEvent[] => {
    if (!program || !season) return [];
    const start = new Date(`${program.startDate}T00:00:00`);
    return buildPrioritizedSeason({ priorities: program.priorities, sessionsPerWeek: team?.sessionsPerWeek ?? 2 }).flatMap((week) =>
      week.slots.flatMap((slot, index) =>
        season.preparedSlots.some((prepared) => prepared.weekNumber === week.week && prepared.slot === index)
          ? []
          : [
              {
                id: `prevue-${week.week}-${index}`,
                type: "session" as const,
                title: slotLabel(slot),
                date: seasonSlotDate(start, week.week, index, team?.trainingDays ?? []).toISOString(),
                planned: { sessionNumber: slot.sessionNumber, week: week.week, slot: index },
              },
            ],
      ),
    );
  }, [program, season, team]);
  const calendar = useMemo(() => buildSeasonCalendar<CalendarEvent>([...planned, ...(season?.events ?? [])], now), [planned, season, now]);
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
        <Text style={styles.step}>{calendar.label.toUpperCase()}</Text>
        <Text style={styles.title}>Toute ta saison, mois par mois.</Text>

        <GuidedSeason
          fallback={
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
          }
          now={now}
        />

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
              <MonthGrid events={month.events} month={month.month} now={now} year={month.year} />
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
  eventDot: { width: 8, height: 8, borderRadius: 4 },
  eventDotPlanned: { opacity: 0.45 },
  eventTitlePlanned: { color: colors.muted },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 4, marginBottom: 8 },
  gridHeader: { width: `${100 / 7}%`, textAlign: "center", fontSize: 10, fontWeight: "800", color: colors.muted, paddingVertical: 4 },
  gridCell: { width: `${100 / 7}%`, height: 42, alignItems: "center", paddingTop: 4 },
  gridDay: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.ink,
    width: 24,
    height: 24,
    lineHeight: 24,
    textAlign: "center",
    borderRadius: 12,
    overflow: "hidden",
  },
  gridToday: { backgroundColor: colors.primary, color: colors.primaryInk },
  gridDots: { flexDirection: "row", gap: 3, marginTop: 3 },
  gridDot: { width: 6, height: 6, borderRadius: 3 },
  eventBody: { flex: 1 },
  eventTitle: { fontSize: 13, fontWeight: "700", color: colors.ink },
  eventType: { fontSize: 10, fontWeight: "800", color: colors.primary, marginTop: 2 },
});
