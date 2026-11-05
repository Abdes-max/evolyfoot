import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import {
  buildSituationDiagram,
  findProgramSession,
  findProgramSituation,
  programSource,
  programSubThemes,
  seasonSlotDate,
  situationKindLabels,
} from "@evolyfoot/domain";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { DateTimeField } from "../../../components/date-time-field";
import { PlaceInput } from "../../../components/place-input";
import { TacticalDiagramView } from "../../../components/tactical-diagram";
import { useAuth } from "../../../lib/auth-context";

// Durée écoulée depuis l’ouverture de l’écran (indicateur MVP), rien si elle n’a pas démarré.
function preparationSeconds(start: number | null): { preparationSeconds?: number } {
  return start === null ? {} : { preparationSeconds: Math.round((Date.now() - start) / 1000) };
}

const evaluationCount = {
  attack: ["Séquences de plus de 4 passes", "Déséquilibres provoqués", "Tirs", "Buts marqués"],
  defense: ["Ballons récupérés", "Déséquilibres concédés", "Tirs concédés", "Buts encaissés"],
} as const;

export default function ProgramSessionScreen() {
  const { number, semaine, creneau } = useLocalSearchParams<{ number: string; semaine?: string; creneau?: string }>();
  const { apiRequest, team } = useAuth();
  const session = findProgramSession(Number(number));
  const week = Number(semaine);
  const slot = Number(creneau);
  const preparable = Number.isInteger(week) && week >= 1 && week <= 36 && Number.isInteger(slot) && slot >= 0 && slot <= 3;
  const [meetingAt, setMeetingAt] = useState<Date | null>(null);
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // Début de la préparation (ouverture de l'écran), pour l'indicateur « première séance en moins de 10 minutes ».
  const preparationStart = useRef<number | null>(null);
  useEffect(() => {
    preparationStart.current = Date.now();
  }, []);

  // Préremplit le rendez-vous (jour d'entraînement de la semaine, 18 h) et le dernier lieu utilisé.
  useEffect(() => {
    if (!preparable) return;
    let cancelled = false;
    (async () => {
      const [programResponse, sessionsResponse] = await Promise.all([apiRequest("/api/season-program"), apiRequest("/api/sessions?scope=season")]);
      const programBody = programResponse?.ok ? await programResponse.json().catch(() => null) : null;
      const sessionsBody = sessionsResponse?.ok ? await sessionsResponse.json().catch(() => null) : null;
      if (cancelled) return;
      const start = programBody?.program?.startDate ? new Date(`${programBody.program.startDate}T00:00:00`) : new Date();
      setMeetingAt(seasonSlotDate(start, week, slot, team?.trainingDays ?? []));
      const sessions: { location: string | null; createdAt: string }[] = sessionsBody?.sessions ?? [];
      const last = [...sessions].filter((item) => item.location).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (last?.location) setLocation((current) => current || last.location!);
    })();
    return () => {
      cancelled = true;
    };
  }, [apiRequest, preparable, week, slot, team]);

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.muted}>Séance introuvable.</Text>
      </SafeAreaView>
    );
  }

  const title =
    session.type === "evaluation"
      ? `Évaluation collective · ${session.focus === "attack" ? "attaque" : "défense"}`
      : session.type === "recreational"
        ? "Séance récréative"
        : programSubThemes[session.subTheme].label;
  const situations = session.type === "evaluation" ? [] : session.situations.map((id) => findProgramSituation(id)!);

  async function prepare() {
    setError("");
    if (!team) {
      setError("Crée d’abord ton équipe pour préparer une séance.");
      return;
    }
    if (!location.trim()) {
      setError("Indique le lieu de la séance.");
      return;
    }
    if (!meetingAt) return;
    setSaving(true);
    const response = await apiRequest("/api/season-program/sessions", {
      method: "POST",
      body: JSON.stringify({
        sessionNumber: session!.number,
        seasonWeek: week,
        slot,
        ageGroup: team.ageGroup,
        playerCount: team.playerCount,
        meetingAt: meetingAt.toISOString(),
        location,
        ...preparationSeconds(preparationStart.current),
      }),
    });
    const body = await response?.json().catch(() => null);
    setSaving(false);
    if (response?.ok && body?.session?.id) {
      router.replace(`/terrain/${body.session.id}`);
      return;
    }
    setError(body?.error ?? "La séance n’a pas pu être préparée.");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.step}>SÉANCE TYPE {session.number}</Text>
        <Text style={styles.title}>{title}</Text>

        {preparable && meetingAt && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Préparer cette séance</Text>
            <Text style={styles.label}>RENDEZ-VOUS</Text>
            <DateTimeField label="Rendez-vous" onChange={setMeetingAt} value={meetingAt} />
            <Text style={styles.label}>LIEU</Text>
            <PlaceInput onChange={setLocation} value={location} />
            <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={prepare} style={[styles.primary, saving && styles.disabled]}>
              <Text style={styles.primaryText}>{saving ? "Préparation…" : "Préparer cette séance"}</Text>
            </TouchableOpacity>
            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
          </View>
        )}

        {session.type === "evaluation" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Déroulé</Text>
            <Text style={styles.body}>
              Échauffement de 20 minutes, puis trois matchs de 20 minutes à 8 contre 8. Laisse jouer sans annoncer ce que tu observes.
            </Text>
            <Text style={styles.label}>À COMPTER PENDANT CHAQUE MATCH</Text>
            {evaluationCount[session.focus].map((item) => (
              <Text key={item} style={styles.body}>
                • {item}
              </Text>
            ))}
          </View>
        ) : (
          situations.map((situation, index) => (
            <View key={`${situation.id}-${index}`} style={styles.card}>
              <Text style={styles.label}>
                {index + 1}. {situationKindLabels[situation.kind].toUpperCase()} · {situation.sequences.count} × {situation.sequences.minutes} MIN ·{" "}
                {situation.fieldSize}
              </Text>
              <Text style={styles.cardTitle}>{situation.title}</Text>
              <TacticalDiagramView diagram={buildSituationDiagram(situation.layout)} label={situation.organization} />
              <Text style={styles.body}>{situation.instruction}</Text>
              {situation.rules.map((rule) => (
                <Text key={rule} style={styles.muted}>
                  • {rule}
                </Text>
              ))}
              {situation.variation ? <Text style={styles.muted}>Variante : {situation.variation}</Text> : null}
            </View>
          ))
        )}
        <Text style={styles.muted}>{programSource}.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  page: { padding: spacing.lg, paddingBottom: 48 },
  back: { fontSize: 12, fontWeight: "800", color: colors.primary, marginBottom: 14 },
  step: { fontSize: 10, fontWeight: "800", color: colors.primary, letterSpacing: 1.1 },
  title: { fontSize: 26, fontWeight: "800", color: colors.ink, marginTop: 10, marginBottom: 16 },
  card: { padding: spacing.md, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, marginBottom: 12, gap: 6 },
  cardTitle: { fontSize: 15, fontWeight: "800", color: colors.ink },
  label: { fontSize: 10, fontWeight: "800", color: colors.primary, letterSpacing: 0.6, marginTop: 6 },
  body: { fontSize: 13, lineHeight: 19, color: colors.ink },
  muted: { fontSize: 11, lineHeight: 16, color: colors.muted },
  error: { fontSize: 12, fontWeight: "700", color: colors.danger },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: { minHeight: 44, minWidth: 44, justifyContent: "center", paddingHorizontal: 12, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line },
  actionText: { fontSize: 12, fontWeight: "800", color: colors.ink },
  primary: { minHeight: 52, marginTop: 10, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, backgroundColor: colors.primary },
  primaryText: { fontSize: 15, fontWeight: "800", color: colors.primaryInk },
  disabled: { opacity: 0.5 },
});
