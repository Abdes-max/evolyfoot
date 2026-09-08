import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { gameFormats } from "@evolyfoot/domain";
import type { GameFormat, MatchStatus, MatchVenue } from "@evolyfoot/domain";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth, type MobileMatch } from "../lib/auth-context";

const statusLabel: Record<MatchStatus, string> = { scheduled: "À venir", played: "Joué" };
const venueLabel: Record<MatchVenue, string> = { home: "Domicile", away: "Extérieur" };

export default function MatchListScreen() {
  const { team, listMatches, createMatch } = useAuth();
  const [matches, setMatches] = useState<MobileMatch[]>([]);
  const [creating, setCreating] = useState(false);
  const [opponent, setOpponent] = useState("");
  const [dateLabel, setDateLabel] = useState("");
  const [venue, setVenue] = useState<MatchVenue>("home");
  // `null` tant que le coach n'a pas explicitement choisi un format : dérivé du format de
  // l'équipe au rendu plutôt que copié dans un `useState` via un effet (évite un rendu en
  // cascade, règle react-hooks/set-state-in-effect -- même correctif que sidebar-nav.tsx côté
  // web pour un problème analogue).
  const [selectedGameFormat, setSelectedGameFormat] = useState<GameFormat | null>(null);
  const gameFormat = selectedGameFormat ?? (team && gameFormats.includes(team.gameFormat as GameFormat) ? (team.gameFormat as GameFormat) : 8);
  const [createError, setCreateError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const result = await listMatches();
      if (result.ok) {
        setMatches(result.matches);
      }
    })();
  }, [listMatches]);

  async function submitCreate() {
    setSubmitting(true);
    setCreateError("");
    const result = await createMatch({ opponent, dateLabel, venue, gameFormat });
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
        <Text style={styles.body}>Compose ton équipe, désigne un capitaine, puis observe le match une fois joué pour ajuster tes prochaines séances si nécessaire.</Text>

        {!creating ? (
          <TouchableOpacity accessibilityRole="button" onPress={() => setCreating(true)} style={styles.newButton}>
            <Text style={styles.newButtonText}>+ Nouveau match</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.createForm}>
            <Text style={styles.label}>Équipe adverse</Text>
            <TextInput onChangeText={setOpponent} placeholder="Ex. US Vallée" style={styles.input} value={opponent} />
            <Text style={styles.label}>Date</Text>
            <TextInput onChangeText={setDateLabel} placeholder="Ex. Samedi 12 septembre · 10:30" style={styles.input} value={dateLabel} />

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

            {createError ? <Text style={styles.fieldError}>{createError}</Text> : null}
            <View style={styles.createActions}>
              <TouchableOpacity accessibilityRole="button" disabled={submitting} onPress={submitCreate} style={styles.submitButton}>
                <Text style={styles.submitButtonText}>{submitting ? "Création…" : "Créer le match"}</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" onPress={() => setCreating(false)} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {matches.length === 0 ? (
          <Text style={styles.empty}>Aucun match préparé pour l’instant.</Text>
        ) : (
          matches.map((match) => (
            <TouchableOpacity
              accessibilityRole="button"
              key={match.id}
              onPress={() => router.push({ pathname: "/match/[id]", params: { id: match.id } })}
              style={styles.card}
            >
              <View style={styles.cardTop}>
                <View style={[styles.statusBadge, match.status === "played" && styles.statusBadgePlayed]}>
                  <Text style={[styles.statusText, match.status === "played" && styles.statusTextPlayed]}>{statusLabel[match.status]}</Text>
                </View>
                <Text style={styles.cardFormat}>Foot à {match.gameFormat}</Text>
              </View>
              <Text style={styles.cardTitle}>{match.opponent}</Text>
              <Text style={styles.cardBody}>
                {match.dateLabel} · {venueLabel[match.venue]}
              </Text>
              <Text style={styles.cardLineup}>
                {match.lineup.length}/{match.gameFormat} postes pourvus
              </Text>
              <Text style={styles.cardLink}>{match.status === "played" ? "Voir la composition →" : "Préparer la composition →"}</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  choice: { minHeight: 40, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  formatChoice: { minHeight: 40, minWidth: 40, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  choiceActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  choiceText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  choiceTextActive: { color: colors.primary },
  fieldError: { color: colors.danger, fontSize: 10, marginTop: 10 },
  createActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  submitButton: { minHeight: 40, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, borderRadius: radii.sm },
  submitButtonText: { color: colors.primaryInk, fontSize: 11, fontWeight: "800" },
  cancelButton: { minHeight: 40, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm },
  cancelButtonText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  empty: { color: colors.muted, fontSize: 11, textAlign: "center", marginTop: 30 },
  card: { marginTop: 14, padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusBadge: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: radii.pill, backgroundColor: colors.primarySoft },
  statusBadgePlayed: { backgroundColor: "rgba(52,211,153,.14)" },
  statusText: { fontSize: 9, fontWeight: "800", color: colors.primary, textTransform: "uppercase" },
  statusTextPlayed: { color: "#34d399" },
  cardFormat: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  cardTitle: { fontSize: 17, fontWeight: "800", color: colors.ink, marginTop: 6 },
  cardBody: { color: colors.muted, fontSize: 11.5, marginTop: 2 },
  cardLineup: { color: colors.ink, fontSize: 11.5, fontWeight: "700", marginTop: 4 },
  cardLink: { color: colors.primary, fontSize: 11.5, fontWeight: "800", marginTop: 8 },
});
