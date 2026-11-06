import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { seasonSlotColor, themeColors, type SavedTrainingSession, type SeasonCycle } from "@evolyfoot/domain";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { openSeasonSlot } from "../lib/season-cycle";
import { slotLabel } from "./guided-season";

// Vue « Par cycle » de l'onglet Séances avec une saison guidée : les 4 semaines d'un cycle de la
// saison, chaque créneau aux couleurs du thème de sa séance (même écran que le web).
export function SeasonCycleList({
  cycles,
  currentCycle,
  currentSeasonWeek,
  prepared,
  slotLabels,
}: {
  cycles: readonly SeasonCycle[];
  currentCycle: SeasonCycle;
  currentSeasonWeek: number;
  prepared: readonly SavedTrainingSession[];
  slotLabels: readonly string[];
}) {
  const [index, setIndex] = useState(currentCycle.number - 1);
  const cycle = cycles[Math.min(cycles.length - 1, Math.max(0, index))] ?? currentCycle;

  return (
    <View>
      <View style={styles.nav}>
        <TouchableOpacity accessibilityLabel="Cycle précédent" accessibilityRole="button" disabled={index <= 0} hitSlop={8} onPress={() => setIndex(index - 1)}>
          <Text style={[styles.navArrow, index <= 0 && styles.disabled]}>‹</Text>
        </TouchableOpacity>
        <View style={styles.navTitle}>
          <Text style={styles.navCycle}>
            Cycle {cycle.number}/{cycle.count}
            {cycle.number === currentCycle.number ? " · en cours" : ""}
          </Text>
          <Text style={[styles.navTheme, { color: themeColors[cycle.theme] }]}>{cycle.theme}</Text>
        </View>
        <TouchableOpacity
          accessibilityLabel="Cycle suivant"
          accessibilityRole="button"
          disabled={index >= cycles.length - 1}
          hitSlop={8}
          onPress={() => setIndex(index + 1)}
        >
          <Text style={[styles.navArrow, index >= cycles.length - 1 && styles.disabled]}>›</Text>
        </TouchableOpacity>
      </View>

      {cycle.weeks.map((week) => (
        <View
          key={week.seasonWeek}
          style={[styles.week, { borderLeftColor: themeColors[week.theme] }, week.seasonWeek === currentSeasonWeek && styles.weekCurrent]}
        >
          <Text style={styles.weekTitle}>
            Semaine {week.seasonWeek} · {week.phase}
            {week.seasonWeek === currentSeasonWeek ? " · en cours" : ""}
          </Text>
          <Text style={styles.weekTheme}>{week.intention}</Text>
          {week.slots.map((slot, position) => {
            const done = prepared.find((session) => session.weekNumber === week.seasonWeek && session.slot === position);
            const color = seasonSlotColor(slot);
            return (
              <TouchableOpacity
                accessibilityRole="button"
                key={position}
                onPress={() => openSeasonSlot(slot.sessionNumber, week.seasonWeek, position, done?.id)}
                style={[styles.slot, { borderLeftColor: color }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.slotDay}>{slotLabels[position] ?? `Séance ${position + 1}`}</Text>
                  <Text style={[styles.slotTitle, { color }]}>
                    {slotLabel(slot)}
                    {slot.major ? " · prioritaire" : ""}
                  </Text>
                  <Text style={styles.slotStatus}>{done ? (done.title ?? "Séance prête") : `Séance ${slot.sessionNumber} du programme, à préparer`}</Text>
                </View>
                <View style={[styles.slotButton, done ? { backgroundColor: color } : { borderColor: color, borderWidth: 1 }]}>
                  <Text style={[styles.slotButtonText, { color: done ? colors.primaryInk : color }]}>{done ? "Ouvrir" : "Préparer"}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  navArrow: { color: colors.ink, fontSize: 28, fontWeight: "800", paddingHorizontal: spacing.sm },
  disabled: { opacity: 0.3 },
  navTitle: { alignItems: "center" },
  navCycle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  navTheme: { fontSize: 12, fontWeight: "800", marginTop: 2 },
  week: {
    padding: spacing.md,
    marginBottom: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  weekCurrent: { borderTopColor: colors.primary, borderRightColor: colors.primary, borderBottomColor: colors.primary },
  weekTitle: { fontSize: 14, fontWeight: "800", color: colors.ink },
  weekTheme: { fontSize: 11, color: colors.muted, marginTop: 4, marginBottom: 6 },
  slot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    marginTop: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: colors.line,
    backgroundColor: colors.paper,
  },
  slotDay: { fontSize: 11, fontWeight: "800", color: colors.muted },
  slotTitle: { fontSize: 14, fontWeight: "800", marginTop: 2 },
  slotStatus: { fontSize: 12, color: colors.muted, marginTop: 2 },
  slotButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radii.pill },
  slotButtonText: { fontSize: 12, fontWeight: "900" },
});
