import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import {
  createMatchClock,
  endMatchPeriod,
  isPeriodOver,
  matchClockMinutesRange,
  pauseMatchClock,
  readMatchClock,
  resetMatchClock,
  startMatchClock,
} from "@evolyfoot/domain";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, Vibration, View } from "react-native";
import { useMatchClock } from "../lib/match-clock-store";
import { themedStyles } from "../lib/themed-styles";

// Durées de période courantes en jeunes, pour un choix en un geste.
const minutePresets = [10, 15, 20, 25, 30, 35, 40, 45].filter((minutes) => minutes >= matchClockMinutesRange.min && minutes <= matchClockMinutesRange.max);

// Chronomètre du match, facultatif : une période ou deux mi-temps d'une durée choisie, avec pause, mi-temps
// et temps additionnel. Il reste juste si l'écran se met en veille (voir match-clock.ts côté domaine).
export function MatchClockPanel({ matchId }: { matchId: string }) {
  const { clock, now, update } = useMatchClock(matchId);
  const [open, setOpen] = useState(clock.status !== "ready");
  const reading = readMatchClock(clock, now);
  const over = isPeriodOver(clock, now);
  // À la mi-temps et en fin de match, le compteur de période est remis à zéro : on montre le temps de jeu total.
  const stopped = clock.status === "halftime" || clock.status === "finished";

  // Écran allumé tant que le chronomètre tourne : le coach garde le téléphone en main au bord du terrain.
  useEffect(() => {
    if (clock.status !== "running") return undefined;
    void activateKeepAwakeAsync("match-clock");
    return () => {
      void deactivateKeepAwake("match-clock");
    };
  }, [clock.status]);

  // Une vibration quand la durée de la période est atteinte, une seule fois par période.
  const warnedPeriod = useRef<number | null>(null);
  useEffect(() => {
    if (over && warnedPeriod.current !== clock.period) {
      warnedPeriod.current = clock.period;
      Vibration.vibrate([0, 500, 250, 500]);
    }
  }, [over, clock.period]);

  const lastPeriod = clock.period >= clock.periods;
  const endLabel = lastPeriod ? "Fin du match" : "Fin de la mi-temps";

  function confirmReset() {
    const reset = () => update((current) => resetMatchClock(current));
    if (clock.status === "ready" || clock.status === "finished") {
      reset();
      return;
    }
    Alert.alert("Réinitialiser le chronomètre ?", "Le temps de jeu déjà compté sera perdu.", [
      { text: "Annuler", style: "cancel" },
      { text: "Réinitialiser", style: "destructive", onPress: reset },
    ]);
  }

  return (
    <View style={styles.card}>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Chronomètre du match</Text>
          <Text style={styles.sub}>
            {clock.status === "ready"
              ? `Facultatif · ${clock.periods === 2 ? `2 × ${clock.minutesPerPeriod} min` : `${clock.minutesPerPeriod} min`}`
              : `${reading.periodLabel} · ${reading.main}${reading.added ? ` ${reading.added}` : ""}`}
          </Text>
        </View>
        <Text style={styles.chevron}>{open ? "▾" : "▸"}</Text>
      </TouchableOpacity>

      {open ? (
        <View style={styles.body}>
          {clock.status === "ready" ? (
            <>
              <Text style={styles.label}>Format</Text>
              <View style={styles.chips}>
                {([2, 1] as const).map((periods) => (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityState={{ selected: clock.periods === periods }}
                    key={periods}
                    onPress={() => update((current) => createMatchClock({ periods, minutesPerPeriod: current.minutesPerPeriod }))}
                    style={[styles.chip, clock.periods === periods && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, clock.periods === periods && styles.chipTextActive]}>{periods === 2 ? "2 mi-temps" : "Sans mi-temps"}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>{clock.periods === 2 ? "Durée d’une mi-temps" : "Durée du match"}</Text>
              <View style={styles.chips}>
                {minutePresets.map((minutes) => (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityState={{ selected: clock.minutesPerPeriod === minutes }}
                    key={minutes}
                    onPress={() => update((current) => createMatchClock({ periods: current.periods, minutesPerPeriod: minutes }))}
                    style={[styles.chip, clock.minutesPerPeriod === minutes && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, clock.minutesPerPeriod === minutes && styles.chipTextActive]}>{minutes} min</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : null}

          <View
            accessibilityLabel={`${reading.periodLabel}, ${reading.main}${reading.added ? `, temps additionnel ${reading.added}` : ""}`}
            style={styles.clockBox}
          >
            <Text style={styles.period}>{clock.status === "halftime" ? "Mi-temps" : clock.status === "finished" ? "Match terminé" : reading.periodLabel}</Text>
            <View style={styles.clockRow}>
              <Text style={[styles.clock, over && styles.clockOver]}>{stopped ? reading.total : reading.main}</Text>
              {!stopped && reading.added ? <Text style={styles.added}>{reading.added}</Text> : null}
            </View>
            <Text style={styles.target}>
              {stopped ? "Temps de jeu total" : `sur ${reading.target}${clock.periods === 2 ? ` · temps de jeu total ${reading.total}` : ""}`}
            </Text>
            {over ? <Text style={styles.alert}>Durée atteinte : temps additionnel</Text> : null}
          </View>

          <View style={styles.actions}>
            {clock.status === "ready" ? (
              <TouchableOpacity accessibilityRole="button" onPress={() => update((current, time) => startMatchClock(current, time))} style={styles.primary}>
                <Text style={styles.primaryText}>Démarrer le match</Text>
              </TouchableOpacity>
            ) : null}
            {clock.status === "running" ? (
              <>
                <TouchableOpacity accessibilityRole="button" onPress={() => update((current, time) => pauseMatchClock(current, time))} style={styles.primary}>
                  <Text style={styles.primaryText}>Pause</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" onPress={() => update((current, time) => endMatchPeriod(current, time))} style={styles.secondary}>
                  <Text style={styles.secondaryText}>{endLabel}</Text>
                </TouchableOpacity>
              </>
            ) : null}
            {clock.status === "paused" ? (
              <>
                <TouchableOpacity accessibilityRole="button" onPress={() => update((current, time) => startMatchClock(current, time))} style={styles.primary}>
                  <Text style={styles.primaryText}>Reprendre</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" onPress={() => update((current, time) => endMatchPeriod(current, time))} style={styles.secondary}>
                  <Text style={styles.secondaryText}>{endLabel}</Text>
                </TouchableOpacity>
              </>
            ) : null}
            {clock.status === "halftime" ? (
              <TouchableOpacity accessibilityRole="button" onPress={() => update((current, time) => startMatchClock(current, time))} style={styles.primary}>
                <Text style={styles.primaryText}>Lancer la 2e mi-temps</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {clock.status !== "ready" ? (
            <TouchableOpacity accessibilityRole="button" hitSlop={8} onPress={confirmReset}>
              <Text style={styles.reset}>Réinitialiser</Text>
            </TouchableOpacity>
          ) : null}
          {clock.status === "finished" ? <Text style={styles.target}>Pense à marquer le match comme joué, puis à saisir le résultat.</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    card: { marginTop: spacing.md, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: "hidden" },
    head: { flexDirection: "row", alignItems: "center", padding: spacing.md },
    title: { color: colors.ink, fontSize: 15, fontWeight: "900" },
    sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
    chevron: { color: colors.muted, fontSize: 18, paddingLeft: spacing.sm },
    body: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
    label: { color: colors.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase", marginTop: 4 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { color: colors.ink, fontSize: 13, fontWeight: "800" },
    chipTextActive: { color: colors.primaryInk },
    clockBox: { alignItems: "center", gap: 2, paddingVertical: spacing.md, borderRadius: radii.md, backgroundColor: colors.paper },
    period: { color: colors.primary, fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 },
    clockRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
    clock: { color: colors.ink, fontSize: 56, fontWeight: "900", fontVariant: ["tabular-nums"] },
    clockOver: { color: colors.lime },
    added: { color: "#ffb073", fontSize: 24, fontWeight: "900", fontVariant: ["tabular-nums"] },
    target: { color: colors.muted, fontSize: 12, textAlign: "center" },
    alert: { color: "#ffb073", fontSize: 13, fontWeight: "800" },
    actions: { flexDirection: "row", gap: spacing.sm },
    primary: { flex: 1, minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, backgroundColor: colors.primary },
    primaryText: { color: colors.primaryInk, fontSize: 14, fontWeight: "900" },
    secondary: { flex: 1, minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, borderWidth: 1, borderColor: colors.primary },
    secondaryText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
    reset: { color: colors.muted, fontSize: 12, fontWeight: "800", textAlign: "center", textDecorationLine: "underline" },
  }),
);
