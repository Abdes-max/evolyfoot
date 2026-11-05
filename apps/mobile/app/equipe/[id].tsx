import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import {
  buildPlayerEvaluationSeasons,
  playerEvaluationAspectLabels,
  playerEvaluationAspects,
  playerEvaluationMaxScore,
  playerEvaluationMinScore,
  playerSeasonTotals,
  type PlayerEvaluationScores,
  type PlayerSeasonTotals,
} from "@evolyfoot/domain";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, SafeAreaView, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { EvaluationRadar } from "../../components/evaluation-radar";
import { PlayerDetailsForm } from "../../components/player-details-form";
import { useAuth } from "../../lib/auth-context";
import { playerReportHtml, sharePdf, type ReportPlayer } from "../../lib/pdf-export";
import { birthDateFromIso, pickPlayerPhoto } from "../../lib/player-photo";

interface Evaluation {
  id: string;
  source?: "coach" | "player";
  scores: PlayerEvaluationScores;
  createdAt: string;
}

function midpointScores(): PlayerEvaluationScores {
  const midpoint = Math.round((playerEvaluationMinScore + playerEvaluationMaxScore) / 2);
  return Object.fromEntries(playerEvaluationAspects.map((aspect) => [aspect, midpoint])) as PlayerEvaluationScores;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

async function errorOf(response: Response | null, fallback: string): Promise<string> {
  const body = await response?.json().catch(() => null);
  return typeof body?.error === "string" ? body.error : fallback;
}

export default function PlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { apiRequest, team } = useAuth();
  const [player, setPlayer] = useState<ReportPlayer | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [season, setSeason] = useState<PlayerSeasonTotals>({ matches: 0, goals: 0, assists: 0 });
  const [scores, setScores] = useState<PlayerEvaluationScores | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [roster, evaluationList, matches] = await Promise.all([
        apiRequest("/api/roster"),
        apiRequest(`/api/player-evaluations?playerId=${encodeURIComponent(id)}`),
        apiRequest("/api/matches"),
      ]);
      const rosterBody = roster?.ok ? await roster.json().catch(() => null) : null;
      const evaluationsBody = evaluationList?.ok ? await evaluationList.json().catch(() => null) : null;
      const matchesBody = matches?.ok ? await matches.json().catch(() => null) : null;
      if (cancelled) {
        return;
      }
      const found: ReportPlayer | undefined = (rosterBody?.players ?? []).find((candidate: ReportPlayer) => candidate.id === id);
      if (!found) {
        setStatus("missing");
        return;
      }
      setPlayer(found);
      setEvaluations(evaluationsBody?.evaluations ?? []);
      setSeason(playerSeasonTotals(matchesBody?.matches ?? [], id));
      setStatus("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [apiRequest, id]);

  const coachEvaluations = evaluations.filter((evaluation) => evaluation.source !== "player");
  const latestCoach = coachEvaluations[0]?.scores ?? null;
  const latestSelf = evaluations.find((evaluation) => evaluation.source === "player")?.scores ?? null;
  const seasons = buildPlayerEvaluationSeasons(evaluations);

  function adjust(aspect: keyof PlayerEvaluationScores, delta: number) {
    setScores((current) =>
      current ? { ...current, [aspect]: Math.min(playerEvaluationMaxScore, Math.max(playerEvaluationMinScore, current[aspect] + delta)) } : current,
    );
  }

  async function saveEvaluation() {
    if (!scores) {
      return;
    }
    setSaving(true);
    setMessage("");
    const response = await apiRequest("/api/player-evaluations", {
      method: "POST",
      body: JSON.stringify({ playerId: id, scores, date: new Date().toISOString() }),
    });
    setSaving(false);
    if (!response?.ok) {
      setMessage(await errorOf(response, "L’enregistrement a échoué."));
      return;
    }
    const { evaluation } = await response.json();
    setEvaluations((current) => [evaluation, ...current].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setScores(null);
    setMessage("Évaluation enregistrée.");
  }

  async function patchPlayer(patch: Record<string, string | null>): Promise<string | null> {
    const response = await apiRequest(`/api/roster/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
    if (!response?.ok) {
      return errorOf(response, "L’enregistrement a échoué.");
    }
    const body = await response.json();
    setPlayer(body.player);
    return null;
  }

  async function saveDetails(patch: Record<string, string | null>): Promise<string | null> {
    const failure = await patchPlayer(patch);
    if (!failure) {
      setEditing(false);
    }
    return failure;
  }

  async function changePhoto() {
    setPhotoBusy(true);
    try {
      const photo = await pickPlayerPhoto();
      const failure = photo ? await patchPlayer({ photo }) : null;
      if (failure) {
        Alert.alert(failure);
      }
    } catch {
      Alert.alert("Impossible de traiter cette image.");
    } finally {
      setPhotoBusy(false);
    }
  }

  function removePhoto() {
    Alert.alert("Retirer la photo ?", undefined, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Retirer",
        style: "destructive",
        onPress: async () => {
          setPhotoBusy(true);
          const failure = await patchPlayer({ photo: null });
          setPhotoBusy(false);
          if (failure) {
            Alert.alert(failure);
          }
        },
      },
    ]);
  }

  async function inviteTutor() {
    const response = await apiRequest("/api/invites", { method: "POST", body: JSON.stringify({ playerId: id }) });
    if (!response?.ok) {
      Alert.alert(await errorOf(response, "La génération du lien a échoué."));
      return;
    }
    const { url } = await response.json();
    await Share.share({ message: `Suis la progression de ${player?.firstName ?? "ton joueur"} sur EvolyFoot Player : ${url}` }).catch(() => undefined);
  }

  async function exportReport() {
    if (!player) {
      return;
    }
    const result = await sharePdf(playerReportHtml(player, team?.name ?? "", season, latestCoach, coachEvaluations.length), `Bilan de ${player.name}`);
    if (!result.ok) {
      Alert.alert(result.error);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        {status === "loading" && <Text style={styles.muted}>Chargement…</Text>}
        {status === "missing" && <Text style={styles.error}>Ce joueur est introuvable.</Text>}
        {player && (
          <>
            <View style={styles.header}>
              <View style={styles.avatar}>
                {player.photo ? (
                  <Image accessibilityLabel={`Photo de ${player.name}`} source={{ uri: player.photo }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitials}>{`${player.firstName[0] ?? ""}${player.lastName[0] ?? ""}`.toUpperCase()}</Text>
                )}
                {photoBusy && <ActivityIndicator color={colors.primary} style={StyleSheet.absoluteFill} />}
              </View>
              <View style={styles.headerText}>
                <Text style={styles.step}>
                  {[player.position, player.jerseyNumber ? `N° ${player.jerseyNumber}` : null].filter(Boolean).join(" · ").toUpperCase() || "JOUEUR"}
                </Text>
                <Text style={styles.title}>{player.name}</Text>
                <View style={styles.photoActions}>
                  <TouchableOpacity accessibilityRole="button" disabled={photoBusy} hitSlop={6} onPress={changePhoto}>
                    <Text style={styles.link}>{player.photo ? "Changer la photo" : "Ajouter une photo"}</Text>
                  </TouchableOpacity>
                  {player.photo && (
                    <TouchableOpacity accessibilityRole="button" disabled={photoBusy} hitSlop={6} onPress={removePhoto}>
                      <Text style={styles.mutedLink}>Retirer</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>

            <View style={styles.totals}>
              {(
                [
                  ["Matchs", season.matches],
                  ["Buts", season.goals],
                  ["Passes déc.", season.assists],
                ] as const
              ).map(([label, value]) => (
                <View key={label} style={styles.total}>
                  <Text style={styles.totalValue}>{value}</Text>
                  <Text style={styles.totalLabel}>{label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Fiche</Text>
                {!editing && (
                  <TouchableOpacity accessibilityRole="button" hitSlop={8} onPress={() => setEditing(true)}>
                    <Text style={styles.link}>Modifier</Text>
                  </TouchableOpacity>
                )}
              </View>
              {editing ? (
                <PlayerDetailsForm onCancel={() => setEditing(false)} onSave={saveDetails} player={player} />
              ) : (
                <>
                  {(
                    [
                      ["Date de naissance", birthDateFromIso(player.birthDate)],
                      ["Pied fort", player.preferredFoot],
                      ["Téléphone", player.phone],
                      ["E-mail", player.email],
                    ] as const
                  ).map(([label, value]) => (
                    <View key={label} style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{label}</Text>
                      <Text style={value ? styles.detailValue : styles.detailEmpty}>{value || "Non renseigné"}</Text>
                    </View>
                  ))}
                  {player.strengths ? (
                    <>
                      <Text style={styles.label}>Points forts</Text>
                      <Text style={styles.text}>{player.strengths}</Text>
                    </>
                  ) : null}
                  {player.workAreas ? (
                    <>
                      <Text style={styles.label}>Axes de travail</Text>
                      <Text style={styles.text}>{player.workAreas}</Text>
                    </>
                  ) : null}
                </>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Évaluation</Text>
              {latestCoach || latestSelf ? (
                <>
                  <EvaluationRadar coach={latestCoach} self={latestSelf} />
                  <View style={styles.legend}>
                    {latestCoach && <Text style={[styles.legendItem, { color: colors.primary }]}>● Éducateur</Text>}
                    {latestSelf && <Text style={[styles.legendItem, { color: colors.lime }]}>● Auto-évaluation</Text>}
                  </View>
                </>
              ) : (
                <Text style={styles.muted}>Pas encore d’évaluation.</Text>
              )}
              {message ? <Text style={message === "Évaluation enregistrée." ? styles.success : styles.error}>{message}</Text> : null}
              {scores ? (
                <>
                  {playerEvaluationAspects.map((aspect) => (
                    <View key={aspect} style={styles.scoreRow}>
                      <Text style={styles.scoreLabel}>{playerEvaluationAspectLabels[aspect]}</Text>
                      <TouchableOpacity
                        accessibilityLabel={`Baisser ${playerEvaluationAspectLabels[aspect]}`}
                        hitSlop={8}
                        onPress={() => adjust(aspect, -1)}
                        style={styles.step10}
                      >
                        <Text style={styles.stepText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.score}>{scores[aspect]}</Text>
                      <TouchableOpacity
                        accessibilityLabel={`Monter ${playerEvaluationAspectLabels[aspect]}`}
                        hitSlop={8}
                        onPress={() => adjust(aspect, 1)}
                        style={styles.step10}
                      >
                        <Text style={styles.stepText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={saveEvaluation} style={[styles.primary, saving && styles.disabled]}>
                    <Text style={styles.primaryText}>{saving ? "Enregistrement…" : "Enregistrer l’évaluation"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" onPress={() => setScores(null)} style={styles.ghost}>
                    <Text style={styles.link}>Annuler</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => (setScores(latestCoach ?? midpointScores()), setMessage(""))}
                  style={styles.primary}
                >
                  <Text style={styles.primaryText}>Nouvelle évaluation</Text>
                </TouchableOpacity>
              )}
              {coachEvaluations.length > 0 && (
                <Text style={styles.muted}>
                  {coachEvaluations.length} évaluation{coachEvaluations.length > 1 ? "s" : ""} · dernière le {formatDate(coachEvaluations[0]!.createdAt)}
                </Text>
              )}
            </View>

            {seasons.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Progression par saison</Text>
                <Text style={styles.muted}>Moyenne des évaluations de l’éducateur.</Text>
                {seasons.map((season) => (
                  <View key={season.startYear} style={styles.season}>
                    <View style={styles.seasonHead}>
                      <Text style={styles.seasonLabel}>{season.label}</Text>
                      <Text style={styles.seasonOverall}>
                        {season.overall.toLocaleString("fr-FR")}/{playerEvaluationMaxScore}
                        {season.deltaFromPrevious === null ? (
                          ""
                        ) : (
                          <Text style={season.deltaFromPrevious >= 0 ? styles.up : styles.down}>
                            {`  ${season.deltaFromPrevious > 0 ? "+" : ""}${season.deltaFromPrevious.toLocaleString("fr-FR")}`}
                          </Text>
                        )}
                      </Text>
                    </View>
                    <Text style={styles.muted}>
                      {season.count} évaluation{season.count > 1 ? "s" : ""}
                    </Text>
                    {playerEvaluationAspects.map((aspect) => (
                      <View key={aspect} style={styles.barRow}>
                        <Text style={styles.barLabel}>{playerEvaluationAspectLabels[aspect]}</Text>
                        <View style={styles.barTrack}>
                          <View style={[styles.barFill, { width: `${(season.averages[aspect] / playerEvaluationMaxScore) * 100}%` }]} />
                        </View>
                        <Text style={styles.barValue}>{season.averages[aspect].toLocaleString("fr-FR")}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => router.push({ pathname: "/messages/[id]", params: { id: player.id, name: player.name } })}
              style={styles.primary}
            >
              <Text style={styles.primaryText}>Messages avec le joueur ou son tuteur</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" onPress={exportReport} style={styles.outline}>
              <Text style={styles.link}>Exporter le bilan en PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" onPress={inviteTutor} style={styles.outline}>
              <Text style={styles.link}>Inviter le joueur ou son tuteur</Text>
            </TouchableOpacity>
            <Text style={styles.muted}>Le lien donne accès à EvolyFoot Player pour ce joueur seulement.</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  page: { padding: spacing.lg, paddingBottom: 48 },
  back: { fontSize: 12, fontWeight: "800", color: colors.primary, marginBottom: 14 },
  step: { fontSize: 10, fontWeight: "800", color: colors.primary, letterSpacing: 1.1 },
  title: { fontSize: 26, fontWeight: "800", color: colors.ink, marginTop: 4 },
  header: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
  headerText: { flex: 1 },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarInitials: { fontSize: 24, fontWeight: "800", color: colors.primary },
  photoActions: { flexDirection: "row", gap: 16, marginTop: 6 },
  mutedLink: { fontSize: 13, fontWeight: "800", color: colors.muted },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  detailRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.line },
  detailLabel: { fontSize: 12, fontWeight: "700", color: colors.muted },
  detailValue: { flexShrink: 1, fontSize: 12, fontWeight: "700", color: colors.ink, textAlign: "right" },
  detailEmpty: { fontSize: 12, color: colors.muted, fontStyle: "italic" },
  muted: { fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: 6 },
  error: { fontSize: 12, fontWeight: "700", color: colors.danger, marginTop: 6 },
  success: { fontSize: 12, fontWeight: "800", color: colors.primary, marginTop: 6 },
  totals: { flexDirection: "row", gap: 8, marginBottom: 12 },
  total: { flex: 1, alignItems: "center", padding: 12, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line },
  totalValue: { fontSize: 24, fontWeight: "800", color: colors.ink },
  totalLabel: { fontSize: 10, fontWeight: "800", color: colors.muted, marginTop: 2 },
  card: { padding: spacing.md, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: "800", color: colors.ink, marginBottom: 8 },
  label: { fontSize: 10, fontWeight: "800", color: colors.muted, marginTop: 6 },
  text: { fontSize: 13, lineHeight: 19, color: colors.ink, marginTop: 2 },
  legend: { flexDirection: "row", justifyContent: "center", gap: 16 },
  season: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line },
  seasonHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  seasonLabel: { fontSize: 14, fontWeight: "800", color: colors.ink },
  seasonOverall: { fontSize: 13, fontWeight: "800", color: colors.ink },
  up: { color: colors.lime },
  down: { color: colors.danger },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 5 },
  barLabel: { width: 74, fontSize: 11, fontWeight: "700", color: colors.muted },
  barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.line, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3, backgroundColor: colors.primary },
  barValue: { width: 30, textAlign: "right", fontSize: 11, fontWeight: "800", color: colors.ink },
  legendItem: { fontSize: 11, fontWeight: "800" },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.line },
  scoreLabel: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.ink },
  step10: { width: 36, height: 36, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  stepText: { fontSize: 18, fontWeight: "800", color: colors.primary },
  score: { width: 26, textAlign: "center", fontSize: 16, fontWeight: "800", color: colors.ink },
  primary: { minHeight: 46, marginTop: 12, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, backgroundColor: colors.primary },
  primaryText: { color: colors.primaryInk, fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.5 },
  ghost: { minHeight: 40, alignItems: "center", justifyContent: "center" },
  outline: { minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, borderWidth: 1, borderColor: colors.primary, marginTop: 8 },
  link: { fontSize: 13, fontWeight: "800", color: colors.primary },
});
