import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import {
  attendanceDefaultOptions,
  convocationLeadOptions,
  type AttendanceDefault,
  type PlayerSelection,
  type TrainingConvocationSettings,
} from "@evolyfoot/domain";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../lib/auth-context";
import { ConcernedPlayersPicker, type ConcernedPlayer } from "./concerned-players-picker";

// Réglage des convocations aux entraînements (même écran que le web, convocation-settings.tsx),
// joueurs des entraînements compris : déplié tant que l'éducateur n'a pas choisi, sinon un résumé avec « Modifier ».
export function ConvocationSettings() {
  const { apiRequest } = useAuth();
  const [settings, setSettings] = useState<TrainingConvocationSettings | null>(null);
  const [editing, setEditing] = useState(false);
  const [leadDays, setLeadDays] = useState<number | null>(2);
  const [attendanceDefault, setAttendanceDefault] = useState<AttendanceDefault>("ask");
  const [status, setStatus] = useState("");
  const [roster, setRoster] = useState<ConcernedPlayer[]>([]);
  const [playerIds, setPlayerIds] = useState<PlayerSelection>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [response, rosterResponse] = await Promise.all([apiRequest("/api/team/convocations"), apiRequest("/api/roster")]);
      const body = response?.ok ? await response.json().catch(() => null) : null;
      const rosterBody = rosterResponse?.ok ? await rosterResponse.json().catch(() => null) : null;
      if (cancelled || !body?.settings) return;
      const loaded: TrainingConvocationSettings = body.settings;
      setSettings(loaded);
      setRoster(Array.isArray(rosterBody?.players) ? rosterBody.players : []);
      setPlayerIds(loaded.playerIds ?? null);
      if (loaded.attendanceDefault) {
        setLeadDays(loaded.leadDays);
        setAttendanceDefault(loaded.attendanceDefault);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiRequest]);

  async function save() {
    setStatus("");
    const response = await apiRequest("/api/team/convocations", { method: "PUT", body: JSON.stringify({ leadDays, attendanceDefault, playerIds }) });
    const body = response?.ok ? await response.json().catch(() => null) : null;
    if (!body?.settings) {
      setStatus("Le réglage n’a pas été enregistré.");
      return;
    }
    setSettings(body.settings);
    setEditing(false);
  }

  if (!settings) return null;
  const open = editing || !settings.attendanceDefault;

  if (!open) {
    const lead = convocationLeadOptions.find((option) => option.value === settings.leadDays)?.label ?? "";
    const answer = attendanceDefaultOptions.find((option) => option.value === settings.attendanceDefault)?.label ?? "";
    return (
      <View style={styles.summary}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>CONVOCATIONS AUX ENTRAÎNEMENTS</Text>
          <Text style={styles.summaryText}>
            {lead} · {answer}
          </Text>
          {settings.playerIds ? <Text style={styles.hint}>{`${settings.playerIds.length} joueurs des entraînements`}</Text> : null}
        </View>
        <TouchableOpacity accessibilityRole="button" hitSlop={8} onPress={() => setEditing(true)}>
          <Text style={styles.link}>Modifier</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Quand envoyer les convocations aux entraînements ?</Text>
      <Text style={styles.hint}>Avant l’envoi, les joueurs voient la séance programmée, sans pouvoir répondre.</Text>
      <View style={styles.chips}>
        {convocationLeadOptions.map((option) => {
          const selected = leadDays === option.value;
          return (
            <TouchableOpacity
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              key={String(option.value)}
              onPress={() => setLeadDays(option.value)}
              style={[styles.chip, selected && styles.selected]}
            >
              <Text style={styles.chipText}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {attendanceDefaultOptions.map((option) => {
        const selected = attendanceDefault === option.value;
        return (
          <TouchableOpacity
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            key={option.value}
            onPress={() => setAttendanceDefault(option.value)}
            style={[styles.option, selected && styles.selected]}
          >
            <Text style={styles.chipText}>{option.label}</Text>
            <Text style={styles.hint}>{option.hint}</Text>
          </TouchableOpacity>
        );
      })}
      <ConcernedPlayersPicker
        hint="Seuls ces joueurs voient les séances, reçoivent la convocation et peuvent répondre."
        onChange={setPlayerIds}
        roster={roster}
        title="Joueurs des entraînements"
        value={playerIds}
      />
      <TouchableOpacity accessibilityRole="button" disabled={playerIds?.length === 0} onPress={() => void save()} style={styles.save}>
        <Text style={styles.saveText}>Enregistrer</Text>
      </TouchableOpacity>
      {status ? <Text style={styles.error}>{status}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  label: { color: colors.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.6 },
  summaryText: { color: colors.ink, fontSize: 14, fontWeight: "800", marginTop: 2 },
  link: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  title: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  hint: { color: colors.muted, fontSize: 12.5 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  option: { gap: 2, padding: spacing.sm, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  selected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { color: colors.ink, fontSize: 13.5, fontWeight: "800" },
  save: { alignItems: "center", paddingVertical: 12, borderRadius: radii.md, backgroundColor: colors.primary },
  saveText: { color: colors.primaryInk, fontSize: 15, fontWeight: "900" },
  error: { color: "#ff6b6b", fontSize: 13 },
});
