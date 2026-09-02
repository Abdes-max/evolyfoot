import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { Link } from "expo-router";
import { useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../lib/auth-context";

export default function EquipeScreen() {
  const { team, roster, addPlayer, renamePlayer, removePlayer } = useAuth();
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  async function submitAdd() {
    if (!newName.trim()) {
      setAddError("Indique un prénom.");
      return;
    }
    setAdding(true);
    setAddError("");
    const result = await addPlayer(newName);
    setAdding(false);
    if (!result.ok) {
      setAddError(result.error);
      return;
    }
    setNewName("");
  }

  function startEditing(id: string, name: string) {
    setEditingId(id);
    setEditingName(name);
    setRowError(null);
  }

  async function confirmRename(id: string) {
    if (!editingName.trim()) {
      setRowError({ id, message: "Indique un prénom." });
      return;
    }
    const result = await renamePlayer(id, editingName);
    if (!result.ok) {
      setRowError({ id, message: result.error });
      return;
    }
    setEditingId(null);
  }

  async function confirmRemove(id: string) {
    const result = await removePlayer(id);
    if (!result.ok) {
      setRowError({ id, message: result.error });
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.step}>MON ÉQUIPE</Text>
        <Text style={styles.title}>L’effectif nominatif.</Text>
        <Text style={styles.body}>Ajoute, renomme ou retire un joueur à tout moment — utile pour tes observations.</Text>
        {team && (
          <Text style={styles.teamSummary}>
            {team.name} · {team.ageGroup} · Foot à {team.gameFormat} · {team.playerCount} joueurs au total
          </Text>
        )}

        {!team && (
          <Link asChild href="/onboarding">
            <TouchableOpacity style={styles.noTeamLink}>
              <Text style={styles.noTeamText}>Configure d’abord ton équipe →</Text>
            </TouchableOpacity>
          </Link>
        )}

        <Text style={styles.label}>Ajouter un joueur</Text>
        <View style={styles.addRow}>
          <TextInput
            accessibilityLabel="Ajouter un joueur"
            onChangeText={setNewName}
            placeholder="Prénom"
            style={styles.input}
            value={newName}
          />
          <TouchableOpacity disabled={adding} onPress={submitAdd} style={styles.addButton}>
            <Text style={styles.addButtonText}>{adding ? "Ajout…" : "Ajouter"}</Text>
          </TouchableOpacity>
        </View>
        {addError ? <Text style={styles.fieldError}>{addError}</Text> : null}

        {roster.map((player) => (
          <View key={player.id} style={styles.row}>
            {editingId === player.id ? (
              <>
                <TextInput
                  accessibilityLabel={`Renommer ${player.name}`}
                  onChangeText={setEditingName}
                  style={styles.rowInput}
                  value={editingName}
                />
                <View style={styles.rowActions}>
                  <TouchableOpacity onPress={() => confirmRename(player.id)} style={styles.rowButton}>
                    <Text style={styles.rowButtonText}>Enregistrer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingId(null)} style={styles.rowButton}>
                    <Text style={styles.rowButtonText}>Annuler</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.rowName}>{player.name}</Text>
                <View style={styles.rowActions}>
                  <TouchableOpacity
                    accessibilityLabel={`Renommer ${player.name}`}
                    onPress={() => startEditing(player.id, player.name)}
                    style={styles.rowButton}
                  >
                    <Text style={styles.rowButtonText}>Renommer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityLabel={`Retirer ${player.name}`}
                    onPress={() => confirmRemove(player.id)}
                    style={styles.rowButton}
                  >
                    <Text style={styles.rowButtonText}>Retirer</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            {rowError?.id === player.id ? <Text style={styles.fieldError}>{rowError.message}</Text> : null}
          </View>
        ))}
        {roster.length === 0 && <Text style={styles.empty}>Aucun joueur pour l’instant.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  page: { padding: spacing.lg, paddingBottom: 50 },
  step: { fontSize: 10, fontWeight: "800", color: colors.primary, letterSpacing: 1.1 },
  title: { fontSize: 30, fontWeight: "800", color: colors.ink, marginTop: 10 },
  body: { fontSize: 13, lineHeight: 20, color: colors.muted, marginTop: 8 },
  teamSummary: { fontSize: 11, color: colors.muted, marginTop: 14 },
  noTeamLink: { marginTop: 12, padding: 12, backgroundColor: colors.primarySoft, borderRadius: radii.sm },
  noTeamText: { color: colors.primary, fontSize: 11, fontWeight: "800" },
  label: { fontSize: 11, fontWeight: "800", color: colors.ink, marginTop: 24, marginBottom: 9 },
  addRow: { flexDirection: "row", gap: 9 },
  input: { flex: 1, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: radii.sm, padding: 12, color: colors.ink },
  addButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 18, backgroundColor: colors.primary, borderRadius: radii.sm },
  addButtonText: { color: colors.primaryInk, fontSize: 11, fontWeight: "800" },
  fieldError: { color: colors.danger, fontSize: 10, marginTop: 6 },
  row: { marginTop: 10, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surface, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 },
  rowName: { fontSize: 13, fontWeight: "800", color: colors.ink },
  rowInput: { flex: 1, minWidth: 120, backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1, borderRadius: radii.sm, padding: 9, color: colors.ink },
  rowActions: { flexDirection: "row", gap: 7 },
  rowButton: { minHeight: 36, justifyContent: "center", paddingHorizontal: 12, backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1, borderRadius: radii.sm },
  rowButtonText: { fontSize: 10, fontWeight: "800", color: colors.ink },
  empty: { color: colors.muted, fontSize: 11, textAlign: "center", marginTop: 30 },
});
