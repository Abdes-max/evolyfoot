import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { gameFormats, listFormations, matchesInScope, matchScopeLabels } from "@evolyfoot/domain";
import type { GameFormat, MatchScope, MatchStatus, MatchVenue, PlayerSelection } from "@evolyfoot/domain";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CalendarImport } from "../components/calendar-import";
import { CompetitionsPanel } from "../components/competitions-panel";
import { ConvocationSummary } from "../components/convocation-summary";
import { ConcernedPlayersPicker } from "../components/concerned-players-picker";
import { CalendarIcon, PinIcon } from "../components/icons";
import { DateTimeField } from "../components/date-time-field";
import { PlaceInput } from "../components/place-input";
import { useAuth, type MobileMatch } from "../lib/auth-context";
import { themedStyles } from "../lib/themed-styles";

const statusLabel: Record<MatchStatus, string> = { scheduled: "À venir", played: "Joué" };
const venueLabel: Record<MatchVenue, string> = { home: "Domicile", away: "Extérieur" };

// Score d'un match joué, en vert pour une victoire, en rouge pour une défaite ; sinon rappel de le saisir.
function MatchScore({ match }: { match: MobileMatch }) {
  if (match.goalsFor == null || match.goalsAgainst == null) {
    return <Text style={styles.scoreMissing}>Résultat à saisir</Text>;
  }
  const color = match.goalsFor > match.goalsAgainst ? colors.lime : match.goalsFor < match.goalsAgainst ? colors.danger : colors.ink;
  return (
    <Text style={[styles.score, { color }]}>
      Score : {match.goalsFor} – {match.goalsAgainst}
    </Text>
  );
}

export default function MatchListScreen() {
  const { team, roster, listMatches, createMatch } = useAuth();
  const [matches, setMatches] = useState<MobileMatch[]>([]);
  // Filtre À venir / Passés : s'applique aux matchs, tournois et plateaux.
  const [scope, setScope] = useState<MatchScope>("upcoming");
  const [now] = useState(() => Date.now());
  const [creating, setCreating] = useState(false);
  const [opponent, setOpponent] = useState("");
  const [date, setDate] = useState<Date | null>(null);
  const [venue, setVenue] = useState<MatchVenue>("home");
  const [location, setLocation] = useState("");
  // `null` tant que le coach n'a pas explicitement choisi un format : dérivé du format de
  // l'équipe au rendu plutôt que copié dans un `useState` via un effet (évite un rendu en
  // cascade, règle react-hooks/set-state-in-effect -- même correctif que sidebar-nav.tsx côté
  // web pour un problème analogue).
  const [selectedGameFormat, setSelectedGameFormat] = useState<GameFormat | null>(null);
  const gameFormat = selectedGameFormat ?? (team && gameFormats.includes(team.gameFormat as GameFormat) ? (team.gameFormat as GameFormat) : 8);
  const availableFormations = listFormations(gameFormat);
  const [selectedFormationId, setSelectedFormationId] = useState<string | null>(null);
  const formationId = availableFormations.some((formation) => formation.id === selectedFormationId) ? selectedFormationId! : availableFormations[0]!.id;
  const [createError, setCreateError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Joueurs concernés, tout l'effectif par défaut (voir ConcernedPlayersPicker).
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<PlayerSelection>(null);

  // Relue à chaque retour sur l'écran : un match vient peut-être d'être joué ou son résultat saisi.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const result = await listMatches();
        if (!cancelled && result.ok) {
          setMatches(result.matches);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [listMatches]),
  );

  const shownMatches = matchesInScope(matches, scope, now);

  async function submitCreate() {
    setSubmitting(true);
    setCreateError("");
    const result = await createMatch({
      opponent,
      // Même libellé que le web (frenchDateLabel) : « samedi 12 septembre », l’heure reste dans `date`.
      dateLabel: date ? date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : "",
      date: date ? date.toISOString() : null,
      venue,
      gameFormat,
      formationId,
      ...(location.trim() ? { location: location.trim() } : {}),
      selectedPlayerIds,
    });
    setSubmitting(false);
    if (!result.ok) {
      setCreateError(result.error);
      return;
    }
    router.push({ pathname: "/match/[id]", params: { id: result.match.id } });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.step}>MATCHS</Text>
        <Text style={styles.title}>Prépare et suis tes matchs.</Text>
        <Text style={styles.body}>
          Compose ton équipe, désigne un capitaine, puis observe le match une fois joué pour ajuster tes prochaines séances si nécessaire. Garde aussi une trace
          de tes tournois et plateaux.
        </Text>

        {!creating ? (
          <>
            <TouchableOpacity accessibilityRole="button" onPress={() => setCreating(true)} style={styles.newButton}>
              <Text style={styles.newButtonText}>+ Nouveau match</Text>
            </TouchableOpacity>
            <CalendarImport
              existing={matches}
              formationId={formationId}
              gameFormat={gameFormat}
              onImported={(created) => setMatches((current) => [...current, ...created])}
              teamName={team?.name ?? ""}
            />
          </>
        ) : (
          <View style={styles.createForm}>
            <Text style={styles.label}>Équipe adverse</Text>
            <TextInput onChangeText={setOpponent} placeholder="Ex. US Vallée" style={styles.input} value={opponent} />
            <Text style={styles.label}>Date</Text>
            <DateTimeField label="Date et heure du match" onChange={setDate} value={date} />

            <Text style={styles.label}>Lieu</Text>
            <View style={styles.choiceRow}>
              {(["home", "away"] as const).map((option) => (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{ selected: venue === option }}
                  key={option}
                  onPress={() => setVenue(option)}
                  style={[styles.choice, venue === option && styles.choiceActive]}
                >
                  <Text style={[styles.choiceText, venue === option && styles.choiceTextActive]}>{venueLabel[option]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Adresse du terrain</Text>
            <PlaceInput onChange={setLocation} value={location} />

            <Text style={styles.label}>Format de jeu</Text>
            <View style={styles.choiceRow}>
              {gameFormats.map((format) => (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{ selected: gameFormat === format }}
                  key={format}
                  onPress={() => setSelectedGameFormat(format)}
                  style={[styles.formatChoice, gameFormat === format && styles.choiceActive]}
                >
                  <Text style={[styles.choiceText, gameFormat === format && styles.choiceTextActive]}>{format}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Formation</Text>
            <View style={styles.choiceRow}>
              {availableFormations.map((formation) => (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{ selected: formation.id === formationId }}
                  key={formation.id}
                  onPress={() => setSelectedFormationId(formation.id)}
                  style={[styles.choice, formation.id === formationId && styles.choiceActive]}
                >
                  <Text style={[styles.choiceText, formation.id === formationId && styles.choiceTextActive]}>{formation.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.concerned}>
              <ConcernedPlayersPicker
                hint="Seuls les joueurs cochés voient le match, reçoivent la convocation et entrent dans la composition."
                onChange={setSelectedPlayerIds}
                roster={roster}
                value={selectedPlayerIds}
              />
            </View>

            {createError ? <Text style={styles.fieldError}>{createError}</Text> : null}
            <View style={styles.createActions}>
              <TouchableOpacity
                accessibilityRole="button"
                disabled={submitting || selectedPlayerIds?.length === 0}
                onPress={submitCreate}
                style={styles.submitButton}
              >
                <Text style={styles.submitButtonText}>{submitting ? "Création…" : "Créer le match"}</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" onPress={() => setCreating(false)} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View accessibilityRole="tablist" style={styles.filters}>
          {(["upcoming", "past"] as const).map((value) => (
            <TouchableOpacity
              accessibilityRole="tab"
              accessibilityState={{ selected: scope === value }}
              key={value}
              onPress={() => setScope(value)}
              style={[styles.filter, scope === value && styles.filterActive]}
            >
              <Text style={[styles.filterText, scope === value && styles.filterTextActive]}>{matchScopeLabels[value]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {matches.length === 0 ? (
          <Text style={styles.empty}>Aucun match préparé pour l’instant.</Text>
        ) : shownMatches.length === 0 ? (
          <Text style={styles.empty}>{scope === "past" ? "Aucun match passé." : "Aucun match à venir."}</Text>
        ) : (
          shownMatches.map((match) => (
            <TouchableOpacity
              accessibilityRole="button"
              key={match.id}
              onPress={() => router.push({ pathname: "/match/[id]", params: { id: match.id } })}
              style={styles.card}
            >
              <View style={styles.cardTop}>
                <View style={[styles.statusBadge, match.status === "played" && styles.statusBadgePlayed, match.cancelledAt && styles.statusBadgeCancelled]}>
                  <Text style={[styles.statusText, match.status === "played" && styles.statusTextPlayed, match.cancelledAt && styles.statusTextCancelled]}>
                    {match.cancelledAt ? "Annulé" : statusLabel[match.status]}
                  </Text>
                </View>
                <Text style={styles.cardFormat}>Foot à {match.gameFormat}</Text>
              </View>
              <Text style={styles.cardTitle}>{match.opponent}</Text>
              <View style={styles.metaRow}>
                <CalendarIcon color={colors.primary} size={16} />
                <Text style={styles.cardBody}>
                  {match.dateLabel} · {venueLabel[match.venue]}
                </Text>
              </View>
              {match.location ? (
                <View style={styles.metaRow}>
                  <PinIcon color={colors.primary} size={16} />
                  <Text style={styles.cardBody}>{match.location}</Text>
                </View>
              ) : null}
              {match.status === "played" ? <MatchScore match={match} /> : null}
              {!match.cancelledAt && (match.status === "scheduled" || match.convokedAt) ? (
                <ConvocationSummary attendance={match.attendance} convokedAt={match.convokedAt} roster={roster} selectedPlayerIds={match.selectedPlayerIds} />
              ) : null}
              {match.cancelledAt ? null : (
                <Text style={styles.cardLink}>{match.status === "played" ? "Voir la composition →" : "Préparer la composition →"}</Text>
              )}
            </TouchableOpacity>
          ))
        )}

        <CompetitionsPanel kind="tournament" scope={scope} />
        <CompetitionsPanel kind="plateau" scope={scope} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    concerned: { marginTop: 16 },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
    safe: { flex: 1, backgroundColor: colors.paper },
    page: { padding: spacing.lg, paddingBottom: 50 },
    step: { fontSize: 10, fontWeight: "800", color: colors.primary, letterSpacing: 1.1 },
    title: { fontSize: 28, fontWeight: "800", color: colors.ink, marginTop: 10 },
    body: { fontSize: 13, lineHeight: 20, color: colors.muted, marginTop: 8 },
    newButton: { minHeight: 44, marginTop: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, borderRadius: radii.sm },
    newButtonText: { color: colors.primaryInk, fontSize: 12, fontWeight: "800" },
    createForm: { marginTop: 20, padding: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surface },
    label: { fontSize: 11, fontWeight: "800", color: colors.ink, marginTop: 14, marginBottom: 8 },
    input: { backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1, borderRadius: radii.sm, padding: 12, color: colors.ink },
    choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    choice: {
      minHeight: 40,
      paddingHorizontal: 14,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
    },
    formatChoice: {
      minHeight: 40,
      minWidth: 40,
      paddingHorizontal: 10,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
    },
    choiceActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    choiceText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
    choiceTextActive: { color: colors.primary },
    fieldError: { color: colors.danger, fontSize: 10, marginTop: 10 },
    createActions: { flexDirection: "row", gap: 10, marginTop: 16 },
    submitButton: {
      minHeight: 40,
      paddingHorizontal: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      borderRadius: radii.sm,
    },
    submitButtonText: { color: colors.primaryInk, fontSize: 11, fontWeight: "800" },
    cancelButton: {
      minHeight: 40,
      paddingHorizontal: 16,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radii.sm,
    },
    cancelButtonText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
    empty: { color: colors.muted, fontSize: 11, textAlign: "center", marginTop: 30 },
    card: { marginTop: 14, padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md },
    cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    statusBadgeCancelled: { backgroundColor: "#ef4444", borderColor: "#ef4444" },
    statusTextCancelled: { color: "#ffffff" },
    statusBadge: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: radii.pill, backgroundColor: colors.primarySoft },
    statusBadgePlayed: { backgroundColor: "rgba(52,211,153,.14)" },
    statusText: { fontSize: 9, fontWeight: "800", color: colors.primary, textTransform: "uppercase" },
    statusTextPlayed: { color: "#34d399" },
    cardFormat: { color: colors.muted, fontSize: 10, fontWeight: "700" },
    cardTitle: { fontSize: 17, fontWeight: "800", color: colors.ink, marginTop: 6 },
    filters: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
    filter: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
    filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterText: { color: colors.muted, fontSize: 13, fontWeight: "800" },
    filterTextActive: { color: colors.primaryInk },
    score: { fontSize: 15, fontWeight: "900", marginTop: 8 },
    scoreMissing: { color: colors.primary, fontSize: 12, fontWeight: "800", marginTop: 8 },
    cardBody: { color: colors.muted, fontSize: 11.5, marginTop: 2 },
    cardLink: { color: colors.primary, fontSize: 11.5, fontWeight: "800", marginTop: 8 },
  }),
);
