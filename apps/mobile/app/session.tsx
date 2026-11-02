import {
  adjustBlockDuration,
  buildDevelopmentPlan,
  canReplaceSessionActivity,
  canValidateSession,
  currentCycleWeek,
  demoTeam,
  explainTrainingSession,
  generateTrainingSession,
  getSessionDuration,
  moveSessionBlock,
  rehydrateTrainingSession,
  replaceSessionActivity,
  suggestedMeetingAt,
  summarizeDiagnostic,
  type AttendanceEntry,
  type DiagnosticScores,
} from "@evolyfoot/domain";
import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { Link, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { TacticalDiagramView } from "../components/tactical-diagram";
import { useAuth } from "../lib/auth-context";

const kindLabels = { welcome: "Accueil", activation: "Activation", main: "Situation principale", game: "Jeu" } as const;

// Diagnostic et équipe de démonstration, utilisés tant que l'éducateur connecté n'a pas encore
// fait son diagnostic ou son équipe (mobile est entièrement protégé par connexion -- voir
// _layout.tsx -- donc jamais utilisé pour un visiteur anonyme).
const demoScores: DiagnosticScores = { availability: 3, scanning: 2, progression: 4, reactionAfterLoss: 1 };

function clampSearchNumber(value: string | undefined, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : min;
}

function tomorrowEvening(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(18, 0, 0, 0);
  return date.toISOString();
}

function meetingLabel(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

function shiftMeeting(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

export default function SessionScreen() {
  const { team, diagnosticScores, roster, saveTrainingSession, listSessions, listPersonalExercises, getPlayStyle } = useAuth();
  const params = useLocalSearchParams<{ week?: string; slot?: string }>();
  const weekNumber = clampSearchNumber(params.week, 1, 4);
  const slot = clampSearchNumber(params.slot, 0, 4);
  const plan = buildDevelopmentPlan(summarizeDiagnostic(diagnosticScores ?? demoScores));
  const week = plan.weeks[weekNumber - 1] ?? plan.weeks[0];
  const [variant, setVariant] = useState(0);
  const [playStyle, setPlayStyle] = useState<string | null>(null);
  const [alreadySaved, setAlreadySaved] = useState(false);
  const [meetingAt, setMeetingAt] = useState(tomorrowEvening);
  const [absentPlayerIds, setAbsentPlayerIds] = useState<ReadonlySet<string>>(new Set());
  // Le diagnostic et l'équipe déjà enregistrés (s'ils existent) sont résolus avant que cet écran
  // ne soit atteignable -- voir AuthContext.login -- donc un état paresseux suffit, comme pour le
  // diagnostic dans diagnostic.tsx.
  const [session, setSession] = useState(() => {
    return generateTrainingSession(week, team?.ageGroup ?? demoTeam.ageGroup, team?.playerCount ?? demoTeam.playerCount, slot);
  });
  const explanation = explainTrainingSession(session, week, playStyle);

  useEffect(() => {
    let cancelled = false;
    getPlayStyle().then((style) => {
      if (!cancelled) {
        setPlayStyle(style);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [getPlayStyle]);
  const capturesAttendance = !alreadySaved && roster.length > 0;

  // Une séance déjà enregistrée sur ce créneau est rouverte telle quelle ; sinon le rendez-vous est
  // proposé sur le prochain jour d'entraînement.
  useEffect(() => {
    let cancelled = false;

    Promise.all([listSessions(), listPersonalExercises()]).then(([sessions, personalExercises]) => {
      if (cancelled) {
        return;
      }
      const saved = sessions.find((candidate) => candidate.weekNumber === weekNumber && candidate.slot === slot);
      const restored = saved ? rehydrateTrainingSession(saved, personalExercises) : null;
      if (saved && restored) {
        setSession(restored);
        setAlreadySaved(true);
        if (saved.meetingAt) {
          setMeetingAt(saved.meetingAt);
        }
        return;
      }
      const days = team?.trainingDays ?? [];
      const suggested = suggestedMeetingAt(days[slot], weekNumber, currentCycleWeek(sessions, days.length), new Date());
      if (suggested) {
        setMeetingAt(suggested);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [listPersonalExercises, listSessions, slot, team, weekNumber]);

  function proposeAnotherSession() {
    const nextVariant = variant + 1;
    setVariant(nextVariant);
    editSession(generateTrainingSession(week, session.ageGroup, session.playerCount, slot, nextVariant));
  }

  function toggleAttendance(playerId: string) {
    setAbsentPlayerIds((current) => {
      const next = new Set(current);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  }
  const [validationStatus, setValidationStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const duration = getSessionDuration(session);
  const canValidate = canValidateSession(session);

  function editSession(nextSession: typeof session) {
    setSession(nextSession);
    setValidationStatus("");
    setSaveError("");
  }

  async function validateSession() {
    setSaveError("");
    setSaving(true);
    const attendance: AttendanceEntry[] = capturesAttendance
      ? roster.map((player) => ({ playerId: player.id, playerName: player.name, present: !absentPlayerIds.has(player.id) }))
      : [];
    const result = await saveTrainingSession(session, { weekNumber, slot, meetingAt, attendance });
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    setValidationStatus("Séance prête");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.step}>SÉANCE {slot + 1} · SEMAINE {weekNumber}</Text>
        <Text style={styles.title}>{alreadySaved ? "Ta séance." : "Prépare ta séance."}</Text>
        <Text style={styles.body}>{session.intention}</Text>

        {!alreadySaved && (
          <View style={styles.why}>
            <Text style={styles.summaryLabel}>POURQUOI CETTE SÉANCE</Text>
            <Text style={styles.detailText}>{explanation.summary}</Text>
            {explanation.styleNote ? <Text style={styles.detailText}>{explanation.styleNote}</Text> : null}
            <TouchableOpacity accessibilityRole="button" hitSlop={8} onPress={proposeAnotherSession} style={styles.action}>
              <Text style={styles.actionText}>Proposer une autre séance</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.summary}>
          <View>
            <Text style={styles.summaryLabel}>DÉROULÉ MODULABLE</Text>
            <Text style={styles.summaryTitle}>{session.title}</Text>
            <Text style={styles.summaryTheme}>{session.theme} · {session.playerCount} joueurs</Text>
          </View>
          <Text accessibilityLabel={`Durée totale : ${duration} minutes`} accessibilityLiveRegion="polite" style={styles.duration}>{duration} min</Text>
        </View>

        {session.blocks.map((block, index) => {
          const canReplace = canReplaceSessionActivity(session, index);
          return (
          <View style={styles.card} key={block.id}>
            <View style={styles.cardHeading}>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.blockNumber}>{index + 1}</Text>
                <View style={styles.cardContent}>
                  <Text style={styles.kind}>{kindLabels[block.activity.kind]}</Text>
                  <Text style={styles.cardTitle}>{block.activity.title}</Text>
                </View>
              </View>
              <Text style={styles.blockDuration}>{block.durationMinutes} min</Text>
            </View>
            <Text style={styles.objective}>{block.activity.objective}</Text>
            {block.activity.photo ? null : <TacticalDiagramView diagram={block.activity.diagram} label={`Schéma tactique : ${block.activity.title}`} />}
            <View style={styles.details}>
              <Text style={styles.detailLabel}>ORGANISATION</Text><Text style={styles.detailText}>{block.activity.organization}</Text>
              <Text style={styles.detailLabel}>CONSIGNE</Text><Text style={styles.detailText}>{block.activity.instruction}</Text>
              <Text style={styles.detailLabel}>À OBSERVER</Text><Text style={styles.detailText}>{block.activity.observable}</Text>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity
                accessibilityLabel="Retirer 5 minutes"
                hitSlop={8}
                onPress={() => editSession(adjustBlockDuration(session, index, -5))}
                style={styles.action}
              >
                <Text style={styles.actionText}>− 5 min</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel="Ajouter 5 minutes"
                hitSlop={8}
                onPress={() => editSession(adjustBlockDuration(session, index, 5))}
                style={styles.action}
              >
                <Text style={styles.actionText}>+ 5 min</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel="Monter"
                hitSlop={8}
                disabled={index === 0}
                onPress={() => editSession(moveSessionBlock(session, index, index - 1))}
                style={[styles.action, index === 0 && styles.actionDisabled]}
              >
                <Text style={styles.actionText}>Monter</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel="Descendre"
                hitSlop={8}
                disabled={index === session.blocks.length - 1}
                onPress={() => editSession(moveSessionBlock(session, index, index + 1))}
                style={[styles.action, index === session.blocks.length - 1 && styles.actionDisabled]}
              >
                <Text style={styles.actionText}>Descendre</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel="Remplacer la situation"
                accessibilityHint={canReplace ? "Affiche une autre situation compatible." : "Aucune autre situation compatible pour ce bloc."}
                disabled={!canReplace}
                hitSlop={8}
                onPress={() => editSession(replaceSessionActivity(session, index))}
                style={[styles.action, !canReplace && styles.actionDisabled]}
              >
                <Text style={styles.actionText}>Remplacer</Text>
              </TouchableOpacity>
            </View>
          </View>
        );})}

        <View style={styles.card}>
          <Text style={styles.summaryLabel}>RENDEZ-VOUS</Text>
          <Text style={styles.cardTitle}>{meetingLabel(meetingAt)}</Text>
          <View style={styles.actions}>
            <TouchableOpacity accessibilityLabel="Un jour plus tôt" hitSlop={8} onPress={() => setMeetingAt(shiftMeeting(meetingAt, -1440))} style={styles.action}>
              <Text style={styles.actionText}>− 1 jour</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityLabel="Un jour plus tard" hitSlop={8} onPress={() => setMeetingAt(shiftMeeting(meetingAt, 1440))} style={styles.action}>
              <Text style={styles.actionText}>+ 1 jour</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityLabel="30 minutes plus tôt" hitSlop={8} onPress={() => setMeetingAt(shiftMeeting(meetingAt, -30))} style={styles.action}>
              <Text style={styles.actionText}>− 30 min</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityLabel="30 minutes plus tard" hitSlop={8} onPress={() => setMeetingAt(shiftMeeting(meetingAt, 30))} style={styles.action}>
              <Text style={styles.actionText}>+ 30 min</Text>
            </TouchableOpacity>
          </View>
        </View>

        {capturesAttendance && (
          <View style={styles.card}>
            <Text style={styles.summaryLabel}>PRÉSENCE · TOUCHE LES ABSENTS</Text>
            {roster.map((player) => {
              const absent = absentPlayerIds.has(player.id);
              return (
                <TouchableOpacity
                  accessibilityLabel={`${player.name} : ${absent ? "absent" : "présent"}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: !absent }}
                  key={player.id}
                  onPress={() => toggleAttendance(player.id)}
                  style={styles.attendanceRow}
                >
                  <Text style={styles.cardTitle}>{player.name}</Text>
                  <Text style={absent ? styles.warning : styles.actionText}>{absent ? "Absent" : "Présent"}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {!canValidate && <Text style={styles.warning}>La séance doit durer entre 60 et 90 minutes.</Text>}
        {saveError ? <Text style={styles.warning}>{saveError}</Text> : null}
        <TouchableOpacity
          accessibilityLabel="Valider cette séance"
          disabled={!canValidate || saving}
          onPress={validateSession}
          style={[styles.validate, (!canValidate || saving) && styles.validateDisabled]}
        >
          <Text style={styles.validateText}>{saving ? "Enregistrement…" : "Valider cette séance →"}</Text>
        </TouchableOpacity>
        <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.status}>{validationStatus}</Text>
        {validationStatus && (
          <Link href={`/observation?type=training&week=${weekNumber}`} asChild>
            <TouchableOpacity accessibilityRole="button" style={styles.observationLink}>
              <Text style={styles.observationLinkText}>Observer cette séance →</Text>
            </TouchableOpacity>
          </Link>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  page: { padding: spacing.lg, paddingBottom: 50 },
  why: { gap: 8, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.primary, marginBottom: 16 },
  attendanceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 44, borderBottomWidth: 1, borderBottomColor: colors.line },
  step: { fontSize: 10, fontWeight: "800", color: colors.primary, letterSpacing: 1.1 },
  title: { fontSize: 30, fontWeight: "800", color: colors.ink, marginTop: 10 },
  body: { fontSize: 13, lineHeight: 20, color: colors.muted, marginTop: 8, marginBottom: 24 },
  summary: { flexDirection: "row", justifyContent: "space-between", gap: 16, padding: spacing.md, backgroundColor: colors.primarySoft, borderRadius: radii.md, marginBottom: 16 },
  summaryLabel: { fontSize: 9, letterSpacing: 1, fontWeight: "800", color: colors.primary },
  summaryTitle: { fontSize: 16, fontWeight: "800", color: colors.ink, marginTop: 5 },
  summaryTheme: { fontSize: 11, color: colors.muted, marginTop: 4 },
  duration: { fontSize: 18, fontWeight: "800", color: colors.primary },
  card: { padding: spacing.md, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, marginBottom: 10 },
  cardHeading: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  cardTitleWrap: { flex: 1, flexDirection: "row", gap: 10 },
  blockNumber: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primarySoft, color: colors.primary, fontSize: 11, fontWeight: "800", textAlign: "center", textAlignVertical: "center" },
  cardContent: { flex: 1 },
  kind: { fontSize: 9, fontWeight: "800", color: colors.primary, textTransform: "uppercase" },
  cardTitle: { fontSize: 14, lineHeight: 19, fontWeight: "800", color: colors.ink, marginTop: 3 },
  blockDuration: { fontSize: 12, fontWeight: "800", color: colors.ink },
  objective: { fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: 12 },
  details: { marginTop: 12, padding: 12, backgroundColor: colors.paper, borderRadius: radii.sm },
  detailLabel: { fontSize: 9, fontWeight: "800", color: colors.primary, marginTop: 6 },
  detailText: { fontSize: 10, lineHeight: 15, color: colors.muted, marginTop: 3 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 },
  action: { minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.paper, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line },
  actionDisabled: { opacity: 0.4 },
  actionText: { fontSize: 10, fontWeight: "800", color: colors.ink },
  warning: { fontSize: 12, lineHeight: 18, color: colors.danger, marginTop: 8, marginBottom: 12 },
  validate: { minHeight: 44, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, borderRadius: radii.sm, marginTop: 8, padding: 15 },
  validateDisabled: { opacity: 0.45 },
  validateText: { fontSize: 12, fontWeight: "800", color: colors.primaryInk },
  status: { minHeight: 18, fontSize: 12, fontWeight: "800", color: colors.primary, marginTop: 12, textAlign: "center" },
  observationLink: { minHeight: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.primary, borderRadius: radii.sm, marginTop: 12, paddingHorizontal: 14, backgroundColor: colors.primarySoft },
  observationLinkText: { fontSize: 12, fontWeight: "800", color: colors.primary },
});
