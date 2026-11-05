import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import {
  buildPrioritizedSeason,
  developmentThemes,
  guidedSeasonCycle,
  maxSeasonPriorities,
  programSubThemes,
  seasonThemeCounts,
  seasonWeekAt,
  suggestSeasonPriorities,
  summarizeDiagnostic,
  type DevelopmentTheme,
  type SeasonSlot,
} from "@evolyfoot/domain";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../lib/auth-context";

interface Program {
  priorities: DevelopmentTheme[];
  startDate: string;
}

interface PreparedSession {
  id: string;
  cycleNumber: number;
  weekNumber: number;
  slot: number;
  meetingAt: string | null;
  location: string | null;
}

export const themeColors: Record<DevelopmentTheme, string> = {
  "Conserver le ballon": "#3ec6f5",
  "Progresser ensemble": "#2bc4a8",
  "Finir les actions": "#f59e3e",
  "Récupérer rapidement": "#ef5a5a",
  "Protéger son but": "#a678f0",
};

export function slotLabel(slot: Pick<SeasonSlot, "type" | "subTheme">): string {
  if (slot.type === "evaluation") return "Évaluation";
  if (slot.type === "recreational") return "Séance récréative";
  return programSubThemes[slot.subTheme!].label;
}

function slotColor(slot: Pick<SeasonSlot, "type" | "subTheme">): string {
  if (slot.type === "evaluation") return "#8a93a6";
  if (slot.type === "recreational") return "#d4b05a";
  return themeColors[programSubThemes[slot.subTheme!].theme];
}

function openSeance(sessionNumber: number, week: number, slot: number) {
  router.push({ pathname: "/saison/seance/[number]", params: { number: String(sessionNumber), semaine: String(week), creneau: String(slot) } });
}

// Saison guidée : en un écran, le coach choisit 1 ou 2 thèmes prioritaires puis retrouve chaque
// semaine ses séances, prêtes à préparer.
// Tant qu’aucune saison guidée n’est lancée, l’ancien plan par cycles (`fallback`) reste affiché.
export function GuidedSeason({ now, fallback }: { now: Date; fallback?: ReactNode }) {
  const { apiRequest, team, diagnosticScores } = useAuth();
  const [program, setProgram] = useState<Program | null | undefined>(undefined);
  const [prepared, setPrepared] = useState<PreparedSession[]>([]);
  const [editing, setEditing] = useState(false);
  // `null` tant que le coach n’a rien touché : on part alors des priorités actuelles ou suggérées.
  const [selected, setSelected] = useState<DevelopmentTheme[] | null>(null);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [programResponse, sessionsResponse] = await Promise.all([apiRequest("/api/season-program"), apiRequest("/api/sessions?scope=season")]);
        const programBody = programResponse?.ok ? await programResponse.json().catch(() => null) : null;
        const sessionsBody = sessionsResponse?.ok ? await sessionsResponse.json().catch(() => null) : null;
        if (cancelled) return;
        setPrepared(((sessionsBody?.sessions ?? []) as PreparedSession[]).filter((session) => session.cycleNumber === guidedSeasonCycle));
        setProgram(programBody?.program ?? null);
      })();
      return () => {
        cancelled = true;
      };
    }, [apiRequest]),
  );

  const suggested = useMemo(() => (diagnosticScores ? suggestSeasonPriorities(summarizeDiagnostic(diagnosticScores)) : []), [diagnosticScores]);
  const choice = selected ?? (program ? program.priorities : suggested);
  const weeks = useMemo(
    () => (program ? buildPrioritizedSeason({ priorities: program.priorities, sessionsPerWeek: team?.sessionsPerWeek ?? 2 }) : []),
    [program, team],
  );
  const counts = useMemo(() => seasonThemeCounts(weeks), [weeks]);
  const currentWeek = program ? seasonWeekAt(new Date(`${program.startDate}T00:00:00`), now) : 1;
  // Semaine affichée en détail : la semaine en cours tant que le coach n’en choisit pas une autre.
  const [pickedWeek, setPickedWeek] = useState<number | null>(null);
  const shownWeek = pickedWeek ?? currentWeek;
  const thisWeek = weeks[shownWeek - 1];
  const totalSlots = weeks.reduce((sum, week) => sum + week.slots.length, 0);
  const preparedFor = (week: number, slot: number) => prepared.find((session) => session.weekNumber === week && session.slot === slot);
  const preparedCount = weeks.reduce((sum, week) => sum + week.slots.filter((_, index) => preparedFor(week.week, index)).length, 0);

  function toggle(theme: DevelopmentTheme) {
    const current = choice;
    setSelected(current.includes(theme) ? current.filter((item) => item !== theme) : [...current, theme].slice(-maxSeasonPriorities));
  }

  async function save() {
    setError("");
    const response = await apiRequest("/api/season-program", { method: "PUT", body: JSON.stringify({ priorities: choice }) });
    const body = response?.ok ? await response.json().catch(() => null) : null;
    if (!body?.program) {
      setError("La saison n’a pas pu être enregistrée.");
      return;
    }
    setProgram(body.program);
    setEditing(false);
    setSelected(null);
  }

  if (program === undefined) return null;

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ta saison guidée</Text>
        {!program || editing ? (
          <>
            <Text style={styles.muted}>Choisis 1 ou 2 thèmes prioritaires : environ 60 % des séances, les autres restent travaillés.</Text>
            <View style={styles.chips}>
              {developmentThemes.map((theme) => {
                const active = choice.includes(theme);
                return (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    key={theme}
                    onPress={() => toggle(theme)}
                    style={[styles.chip, active && { backgroundColor: themeColors[theme], borderColor: themeColors[theme] }]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{theme}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={choice.length === 0}
              onPress={save}
              style={[styles.primary, choice.length === 0 && styles.disabled]}
            >
              <Text style={styles.primaryText}>{program ? "Mettre à jour ma saison" : "Lancer ma saison"}</Text>
            </TouchableOpacity>
            {program && (
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => {
                  setEditing(false);
                  setSelected(null);
                }}
              >
                <Text style={styles.link}>Annuler</Text>
              </TouchableOpacity>
            )}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </>
        ) : (
          <>
            <Text style={styles.muted}>Priorités : {program.priorities.join(" · ")}</Text>
            <Text style={styles.muted}>
              {preparedCount} séance{preparedCount > 1 ? "s" : ""} préparée{preparedCount > 1 ? "s" : ""} sur {totalSlots}
            </Text>
            <TouchableOpacity accessibilityRole="button" onPress={() => setEditing(true)}>
              <Text style={styles.link}>Modifier mes priorités</Text>
            </TouchableOpacity>

            {thisWeek && (
              <>
                <View style={styles.weekNav}>
                  <TouchableOpacity
                    accessibilityLabel="Semaine précédente"
                    accessibilityRole="button"
                    disabled={shownWeek <= 1}
                    onPress={() => setPickedWeek(shownWeek - 1)}
                    style={[styles.navButton, shownWeek <= 1 && styles.disabled]}
                  >
                    <Text style={styles.navText}>‹</Text>
                  </TouchableOpacity>
                  <Text style={[styles.label, styles.weekNavLabel]}>
                    SEMAINE {shownWeek} SUR {weeks.length}
                    {shownWeek === currentWeek ? " · CETTE SEMAINE" : ""}
                  </Text>
                  <TouchableOpacity
                    accessibilityLabel="Semaine suivante"
                    accessibilityRole="button"
                    disabled={shownWeek >= weeks.length}
                    onPress={() => setPickedWeek(shownWeek + 1)}
                    style={[styles.navButton, shownWeek >= weeks.length && styles.disabled]}
                  >
                    <Text style={styles.navText}>›</Text>
                  </TouchableOpacity>
                </View>
                {shownWeek !== currentWeek && (
                  <TouchableOpacity accessibilityRole="button" onPress={() => setPickedWeek(null)}>
                    <Text style={[styles.link, styles.backToWeek]}>Revenir à cette semaine</Text>
                  </TouchableOpacity>
                )}
                {thisWeek.slots.map((slot, index) => {
                  const done = preparedFor(shownWeek, index);
                  return (
                    <TouchableOpacity
                      accessibilityRole="button"
                      key={`${slot.sessionNumber}-${index}`}
                      onPress={() => (done ? router.push(`/terrain/${done.id}`) : openSeance(slot.sessionNumber, shownWeek, index))}
                      style={[styles.slotCard, { borderLeftColor: slotColor(slot) }]}
                    >
                      <Text style={styles.muted}>Séance {index + 1}</Text>
                      <Text style={styles.slotTitle}>{slotLabel(slot)}</Text>
                      <Text style={styles.link}>
                        {done
                          ? `Préparée · ${[done.meetingAt ? new Date(done.meetingAt).toLocaleString("fr-FR", { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "", done.location].filter(Boolean).join(" · ")} → Mode terrain`
                          : "Préparer la séance →"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            <View accessibilityLabel="Les 36 semaines de la saison" style={styles.grid}>
              {weeks.map((week) => (
                <View
                  key={week.week}
                  style={[
                    styles.week,
                    week.week < currentWeek && styles.weekPast,
                    week.week === shownWeek && styles.weekShown,
                    week.week === currentWeek && styles.weekCurrent,
                  ]}
                >
                  <TouchableOpacity
                    accessibilityLabel={`Voir la semaine ${week.week}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: week.week === shownWeek }}
                    hitSlop={4}
                    onPress={() => setPickedWeek(week.week)}
                  >
                    <Text style={styles.weekLabel}>S{week.week}</Text>
                  </TouchableOpacity>
                  <View style={styles.weekSlots}>
                    {week.slots.map((slot, index) => {
                      const done = preparedFor(week.week, index);
                      return (
                        <TouchableOpacity
                          accessibilityLabel={`Semaine ${week.week}, séance ${index + 1} : ${slotLabel(slot)}${done ? " (préparée)" : ""}`}
                          accessibilityRole="button"
                          hitSlop={4}
                          key={`${slot.sessionNumber}-${index}`}
                          onPress={() => (done ? router.push(`/terrain/${done.id}`) : openSeance(slot.sessionNumber, week.week, index))}
                          style={[styles.dot, { backgroundColor: slotColor(slot), opacity: done || slot.type !== "theme" || slot.major ? 1 : 0.4 }]}
                        >
                          {done ? <Text style={styles.check}>✓</Text> : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>

            <View accessibilityLabel="Répartition de la saison" style={styles.legend}>
              {developmentThemes.map((theme) => (
                <View key={theme} style={[styles.legendItem, { backgroundColor: themeColors[theme], opacity: program.priorities.includes(theme) ? 1 : 0.55 }]}>
                  <Text style={styles.legendText}>
                    {theme}
                    {program.priorities.includes(theme) ? " (prioritaire)" : ""} · {counts.themes[theme]}
                  </Text>
                </View>
              ))}
              <View style={[styles.legendItem, { backgroundColor: "#8a93a6" }]}>
                <Text style={styles.legendText}>Évaluation · {counts.evaluation}</Text>
              </View>
              <View style={[styles.legendItem, { backgroundColor: "#d4b05a" }]}>
                <Text style={styles.legendText}>Récréative · {counts.recreational}</Text>
              </View>
            </View>
          </>
        )}
      </View>
      {!program && fallback}
    </>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: "800", color: colors.ink, marginBottom: 6 },
  muted: { fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: 3 },
  label: { fontSize: 10, fontWeight: "800", color: colors.primary, letterSpacing: 0.8, marginTop: 14, marginBottom: 6 },
  link: { fontSize: 12, fontWeight: "800", color: colors.primary, marginTop: 8 },
  error: { fontSize: 11, fontWeight: "700", color: colors.danger, marginTop: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: { minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderRadius: 999, borderWidth: 2, borderColor: colors.line },
  chipText: { fontSize: 12, fontWeight: "800", color: colors.ink },
  chipTextActive: { color: colors.paper },
  primary: { minHeight: 48, marginTop: 14, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, backgroundColor: colors.primary },
  primaryText: { fontSize: 14, fontWeight: "800", color: colors.primaryInk },
  disabled: { opacity: 0.5 },
  slotCard: { padding: 12, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line, borderLeftWidth: 6, marginBottom: 8 },
  slotTitle: { fontSize: 14, fontWeight: "800", color: colors.ink, marginTop: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 },
  week: { width: 52, padding: 4, borderRadius: 6, borderWidth: 1, borderColor: colors.line },
  weekCurrent: { borderColor: colors.primary, borderWidth: 2 },
  weekPast: { opacity: 0.6 },
  weekShown: { backgroundColor: colors.paper },
  weekLabel: { fontSize: 9, fontWeight: "800", color: colors.muted },
  weekSlots: { flexDirection: "row", flexWrap: "wrap", gap: 3, marginTop: 3 },
  dot: { width: 18, height: 14, borderRadius: 3, alignItems: "center", justifyContent: "center" },
  check: { fontSize: 9, fontWeight: "900", color: "#0b1018", lineHeight: 11 },
  weekNav: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  weekNavLabel: { flex: 1, textAlign: "center", marginTop: 0, marginBottom: 0 },
  navButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, borderWidth: 1, borderColor: colors.line },
  navText: { fontSize: 20, fontWeight: "800", color: colors.ink },
  backToWeek: { textAlign: "center", marginTop: 4, marginBottom: 8 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 },
  legendItem: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  legendText: { fontSize: 10, fontWeight: "800", color: "#0b1018" },
});
