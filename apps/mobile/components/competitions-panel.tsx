import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../lib/auth-context";
import { competitionDateLabel, competitionKinds, isPastCompetition, sortCompetitions, type Competition, type CompetitionKind } from "../lib/competitions";
import { birthDateToIso } from "../lib/player-photo";

async function readError(response: Response | null): Promise<string> {
  const body = response ? await response.json().catch(() => ({})) : {};
  return typeof body.error === "string" ? body.error : "Une erreur est survenue.";
}

// Section « Tournois » ou « Plateaux » de l'onglet Matchs, comme competitions-panel.tsx côté web :
// ajout rapide (nom, date, bilan) puis une carte par compétition menant à sa fiche.
export function CompetitionsPanel({ kind }: { kind: CompetitionKind }) {
  const { apiRequest } = useAuth();
  const { endpoint, listKey, itemKey, title, singular } = competitionKinds[kind];
  const [items, setItems] = useState<Competition[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Rechargée à chaque retour sur l'onglet : une fiche modifiée ou retirée se reflète aussitôt.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const response = await apiRequest(endpoint);
        const body = response?.ok ? await response.json().catch(() => null) : null;
        if (!cancelled && Array.isArray(body?.[listKey])) {
          setItems(body[listKey]);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [apiRequest, endpoint, listKey]),
  );

  async function add() {
    const date = birthDateToIso(dateInput);
    if (!name.trim() || !date) {
      setError("Indique un nom et une date au format JJ/MM/AAAA.");
      return;
    }
    setSubmitting(true);
    setError("");
    const iso = `${date}T00:00:00.000Z`;
    const response = await apiRequest(endpoint, {
      method: "POST",
      body: JSON.stringify({ name: name.trim(), dateLabel: competitionDateLabel(iso), date: iso, result: result.trim() || undefined }),
    });
    setSubmitting(false);
    if (!response?.ok) {
      setError(await readError(response));
      return;
    }
    const body = await response.json();
    setItems((current) => [body[itemKey], ...current]);
    setName("");
    setDateInput("");
    setResult("");
    setAdding(false);
  }

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {!adding && (
          <TouchableOpacity accessibilityLabel={`Ajouter un ${singular}`} accessibilityRole="button" onPress={() => setAdding(true)} style={styles.addButton}>
            <Text style={styles.addButtonText}>+ Ajouter</Text>
          </TouchableOpacity>
        )}
      </View>

      {adding && (
        <View style={styles.form}>
          <TextInput accessibilityLabel={`Nom du ${singular}`} onChangeText={setName} placeholder={`Nom du ${singular}`} style={styles.input} value={name} />
          <TextInput accessibilityLabel="Date" keyboardType="numbers-and-punctuation" onChangeText={setDateInput} placeholder="Date (JJ/MM/AAAA)" style={styles.input} value={dateInput} />
          <TextInput accessibilityLabel="Bilan" onChangeText={setResult} placeholder="Bilan (optionnel)" style={styles.input} value={result} />
          {error ? <Text style={styles.fieldError}>{error}</Text> : null}
          <View style={styles.actions}>
            <TouchableOpacity accessibilityRole="button" disabled={submitting} onPress={add} style={styles.submitButton}>
              <Text style={styles.submitButtonText}>{submitting ? "Ajout…" : "Ajouter"}</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" onPress={() => setAdding(false)} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {items.length === 0 ? (
        <Text style={styles.empty}>Aucun {singular} pour l’instant.</Text>
      ) : (
        sortCompetitions(items).map((item) => {
          const past = isPastCompetition(item);
          return (
            <TouchableOpacity
              accessibilityLabel={`${item.name} — Voir le détail`}
              accessibilityRole="button"
              key={item.id}
              onPress={() => router.push({ pathname: "/competition/[id]", params: { id: item.id, kind } })}
              style={styles.card}
            >
              <View style={[styles.statusBadge, past && styles.statusBadgePast]}>
                <Text style={[styles.statusText, past && styles.statusTextPast]}>{past ? "Passé" : "À venir"}</Text>
              </View>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardBody}>
                {item.dateLabel}
                {item.location ? ` · ${item.location}` : ""}
                {item.result ? ` · ${item.result}` : ""}
              </Text>
              <Text style={styles.cardLink}>Voir le détail →</Text>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 30 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 18, fontWeight: "800", color: colors.ink },
  addButton: { minHeight: 36, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.primary, borderRadius: radii.sm },
  addButtonText: { color: colors.primary, fontSize: 11, fontWeight: "800" },
  form: { marginTop: 12, padding: spacing.md, gap: 10, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surface },
  input: { backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1, borderRadius: radii.sm, padding: 12, color: colors.ink },
  fieldError: { color: colors.danger, fontSize: 10 },
  actions: { flexDirection: "row", gap: 10 },
  submitButton: { minHeight: 40, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, borderRadius: radii.sm },
  submitButtonText: { color: colors.primaryInk, fontSize: 11, fontWeight: "800" },
  cancelButton: { minHeight: 40, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm },
  cancelButtonText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  empty: { color: colors.muted, fontSize: 11, marginTop: 12 },
  card: { marginTop: 12, padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md },
  statusBadge: { alignSelf: "flex-start", paddingVertical: 5, paddingHorizontal: 10, borderRadius: radii.pill, backgroundColor: colors.primarySoft },
  statusBadgePast: { backgroundColor: "rgba(52,211,153,.14)" },
  statusText: { fontSize: 9, fontWeight: "800", color: colors.primary, textTransform: "uppercase" },
  statusTextPast: { color: "#34d399" },
  cardTitle: { fontSize: 16, fontWeight: "800", color: colors.ink, marginTop: 6 },
  cardBody: { color: colors.muted, fontSize: 11.5, marginTop: 2 },
  cardLink: { color: colors.primary, fontSize: 11.5, fontWeight: "800", marginTop: 8 },
});
