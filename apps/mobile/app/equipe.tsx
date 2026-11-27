import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { playerPositionCodes, playerPositions, teamLineupMaxSubstitutes, type CompetitionLineup, type GameFormat } from "@evolyfoot/domain";
import { Link, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { CollapsibleSection } from "../components/collapsible-section";
import { CompetitionLineupEditor } from "../components/competition-lineup";
import { PlayerAvatar } from "../components/player-avatar";
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { TeamCrest } from "../components/team-crest";
import { useAuth, type AuthResult } from "../lib/auth-context";
import { useUnread } from "../lib/push";
import { pickTeamLogo } from "../lib/team-logo";
import { themedStyles } from "../lib/themed-styles";

// Même regroupement que la page Équipe du web : par poste, dans l’ordre du terrain, puis par numéro.
const positionGroups = [...playerPositions.map((position) => ({ key: position as string, label: position as string })), { key: "", label: "Sans poste" }];

export default function EquipeScreen() {
  const { team, roster, addPlayer, renamePlayer, removePlayer, saveTeamLogo, saveTeamCalendarFeedUrl, sessionToken, apiRequest } = useAuth();
  // Compo type de l'équipe (indépendante des matchs) : undefined tant qu'elle n'est pas chargée.
  const [teamLineup, setTeamLineup] = useState<CompetitionLineup | null | undefined>(undefined);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      apiRequest("/api/team/lineup")
        .then((response) => (response?.ok ? response.json() : null))
        .then((body) => {
          if (!cancelled) setTeamLineup(body?.lineup ?? null);
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }, [apiRequest]),
  );
  const { pendingTutorPlayerIds } = useUnread(sessionToken);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState("");

  // Choisit un logo dans la galerie, ou retire l'actuel (`remove`).
  async function changeLogo(remove = false) {
    setLogoBusy(true);
    setLogoError("");
    try {
      const logo = remove ? null : await pickTeamLogo();
      if (!remove && logo === null) return;
      const result = await saveTeamLogo(logo);
      if (!result.ok) setLogoError(result.error);
    } catch {
      setLogoError("Cette image n’a pas pu être lue.");
    } finally {
      setLogoBusy(false);
    }
  }

  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingFirstName, setEditingFirstName] = useState("");
  const [editingLastName, setEditingLastName] = useState("");
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  async function submitAdd() {
    if (!newFirstName.trim() || !newLastName.trim()) {
      setAddError("Indique un prénom et un nom.");
      return;
    }
    setAdding(true);
    setAddError("");
    const result = await addPlayer(newFirstName, newLastName);
    setAdding(false);
    if (!result.ok) {
      setAddError(result.error);
      return;
    }
    setNewFirstName("");
    setNewLastName("");
  }

  function startEditing(id: string, firstName: string, lastName: string) {
    setEditingId(id);
    setEditingFirstName(firstName);
    setEditingLastName(lastName);
    setRowError(null);
  }

  async function confirmRename(id: string) {
    if (!editingFirstName.trim() || !editingLastName.trim()) {
      setRowError({ id, message: "Indique un prénom et un nom." });
      return;
    }
    const result = await renamePlayer(id, editingFirstName, editingLastName);
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
        <Text style={styles.title}>Ton équipe.</Text>
        {team && (
          <View style={styles.teamCard}>
            <TeamCrest logo={team.logo} name={team.name} size={52} />
            <View style={{ flex: 1 }}>
              <Text style={styles.teamName}>{team.name}</Text>
              <Text style={styles.teamSummary}>
                {team.ageGroup} · Foot à {team.gameFormat} · {roster.length} joueur{roster.length > 1 ? "s" : ""}
              </Text>
              <View style={{ flexDirection: "row", gap: 16, marginTop: 6 }}>
                <TouchableOpacity accessibilityRole="button" disabled={logoBusy} hitSlop={6} onPress={() => void changeLogo()}>
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "800" }}>
                    {logoBusy ? "Envoi…" : team.logo ? "Changer le logo" : "Choisir un logo"}
                  </Text>
                </TouchableOpacity>
                {team.logo ? (
                  <TouchableOpacity accessibilityRole="button" disabled={logoBusy} hitSlop={6} onPress={() => void changeLogo(true)}>
                    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>Retirer</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {logoError ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }}>{logoError}</Text> : null}
            </View>
          </View>
        )}

        {team && <TeamCalendarFeedCard calendarFeedUrl={team.calendarFeedUrl ?? null} onSave={saveTeamCalendarFeedUrl} />}

        {!team && (
          <Link asChild href="/onboarding">
            <TouchableOpacity style={styles.noTeamLink}>
              <Text style={styles.noTeamText}>Configure d’abord ton équipe →</Text>
            </TouchableOpacity>
          </Link>
        )}

        <TouchableOpacity accessibilityRole="link" onPress={() => router.push("/statistiques")} style={styles.statsLink}>
          <Text style={styles.statsLinkText}>Statistiques de l’équipe</Text>
          <Text style={styles.statsLinkText}>→</Text>
        </TouchableOpacity>

        {team && teamLineup !== undefined ? (
          <CollapsibleSection
            style={{ marginTop: spacing.lg }}
            summary={
              teamLineup?.lineup.length
                ? `${teamLineup.lineup.length} titulaires · ${teamLineup.substitutePlayerIds.length} remplaçants · foot à ${teamLineup.gameFormat}`
                : "Facultative"
            }
            title="Compo type"
          >
            <Text style={styles.lineupHint}>{`Ta composition de référence, sans lien avec un match : jusqu’à ${teamLineupMaxSubstitutes} remplaçants.`}</Text>
            <View style={{ marginTop: spacing.md }}>
              <CompetitionLineupEditor
                defaultGameFormat={(team.gameFormat ?? 8) as GameFormat}
                initial={teamLineup}
                lineupUrl="/api/team/lineup"
                maxBench={teamLineupMaxSubstitutes}
                players={roster}
                startLabel="Préparer la compo type"
              />
            </View>
          </CollapsibleSection>
        ) : null}

        <Text style={styles.label}>Ajouter un joueur</Text>
        <View style={styles.addRow}>
          <TextInput accessibilityLabel="Prénom du joueur" onChangeText={setNewFirstName} placeholder="Prénom" style={styles.input} value={newFirstName} />
          <TextInput accessibilityLabel="Nom du joueur" onChangeText={setNewLastName} placeholder="Nom" style={styles.input} value={newLastName} />
          <TouchableOpacity disabled={adding} onPress={submitAdd} style={styles.addButton}>
            <Text style={styles.addButtonText}>{adding ? "Ajout…" : "Ajouter"}</Text>
          </TouchableOpacity>
        </View>
        {addError ? <Text style={styles.fieldError}>{addError}</Text> : null}

        {positionGroups.map((group) => {
          const members = roster
            .filter((player) => (player.position && (playerPositions as readonly string[]).includes(player.position) ? player.position : "") === group.key)
            .sort((a, b) => (Number(a.jerseyNumber) || 99) - (Number(b.jerseyNumber) || 99) || a.name.localeCompare(b.name, "fr"));
          if (members.length === 0) return null;
          return (
            <View key={group.key || "none"}>
              <Text style={styles.groupTitle}>{group.label}</Text>
              {members.map((player) => (
                <View key={player.id} style={styles.row}>
                  {editingId === player.id ? (
                    <>
                      <TextInput
                        accessibilityLabel={`Prénom de ${player.name}`}
                        onChangeText={setEditingFirstName}
                        style={styles.rowInput}
                        value={editingFirstName}
                      />
                      <TextInput
                        accessibilityLabel={`Nom de ${player.name}`}
                        onChangeText={setEditingLastName}
                        style={styles.rowInput}
                        value={editingLastName}
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
                      <TouchableOpacity
                        accessibilityHint="Ouvre la fiche du joueur"
                        accessibilityRole="link"
                        onPress={() => router.push(`/equipe/${player.id}`)}
                        style={styles.rowNameLink}
                      >
                        <PlayerAvatar name={player.name} photo={player.photo} style={styles.avatar} textStyle={styles.avatarText} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowName}>{player.name}</Text>
                          {pendingTutorPlayerIds.includes(player.id) ? (
                            <View style={styles.tutorRequest}>
                              <Text style={styles.tutorRequestText}>Demande de tuteur</Text>
                            </View>
                          ) : null}
                          <Text style={styles.rowPosition}>
                            {group.key ? `${group.key} (${playerPositionCodes[group.key as keyof typeof playerPositionCodes]})` : "Poste à renseigner"}
                          </Text>
                        </View>
                        <Text style={styles.jersey}>{player.jerseyNumber || "–"}</Text>
                      </TouchableOpacity>
                      <View style={styles.rowActions}>
                        <TouchableOpacity
                          accessibilityLabel={`Renommer ${player.name}`}
                          onPress={() => startEditing(player.id, player.firstName, player.lastName)}
                          style={styles.rowButton}
                        >
                          <Text style={styles.rowButtonText}>✎</Text>
                        </TouchableOpacity>
                        <TouchableOpacity accessibilityLabel={`Retirer ${player.name}`} onPress={() => confirmRemove(player.id)} style={styles.rowButton}>
                          <Text style={styles.rowButtonText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                  {rowError?.id === player.id ? <Text style={styles.fieldError}>{rowError.message}</Text> : null}
                </View>
              ))}
            </View>
          );
        })}
        {roster.length === 0 && <Text style={styles.empty}>Aucun joueur pour l’instant.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

// Monté seulement une fois l'équipe chargée (voir `{team && <TeamCalendarFeedCard .../>}` ci-dessus) :
// l'état local part donc toujours de la bonne valeur initiale, sans effet pour le resynchroniser.
function TeamCalendarFeedCard({ calendarFeedUrl, onSave }: { calendarFeedUrl: string | null; onSave: (url: string | null) => Promise<AuthResult> }) {
  const [input, setInput] = useState(calendarFeedUrl ?? "");
  const [current, setCurrent] = useState(calendarFeedUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(url: string | null) {
    setBusy(true);
    setError("");
    const result = await onSave(url);
    if (result.ok) {
      setCurrent(url);
      setInput(url ?? "");
    } else {
      setError(result.error);
    }
    setBusy(false);
  }

  return (
    <View style={styles.feedCard}>
      <Text style={styles.feedLabel}>Flux de calendrier (.ics)</Text>
      <Text style={styles.feedHint}>
        Les matchs d’un flux (ex. calendrier officiel de la ligue) sont ajoutés automatiquement, avec un repère « Flux » : leur date et leur lieu ne sont plus
        modifiables à la main.
      </Text>
      <View style={styles.addRow}>
        <TextInput
          accessibilityLabel="URL du flux de calendrier"
          autoCapitalize="none"
          editable={!busy}
          onChangeText={setInput}
          placeholder="https://…/calendrier.ics"
          style={styles.input}
          value={input}
        />
        <TouchableOpacity disabled={busy} onPress={() => void save(input.trim() || null)} style={styles.addButton}>
          <Text style={styles.addButtonText}>{busy ? "…" : "OK"}</Text>
        </TouchableOpacity>
      </View>
      {current ? (
        <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => void save(null)}>
          <Text style={styles.feedRemove}>Retirer le flux</Text>
        </TouchableOpacity>
      ) : null}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.paper },
    page: { padding: spacing.lg, paddingBottom: 50 },
    step: { fontSize: 10, fontWeight: "800", color: colors.primary, letterSpacing: 1.1 },
    title: { fontSize: 30, fontWeight: "800", color: colors.ink, marginTop: 10 },
    body: { fontSize: 13, lineHeight: 20, color: colors.muted, marginTop: 8 },
    teamCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      marginTop: 16,
      padding: spacing.md,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.primaryDark,
      backgroundColor: colors.primarySoft,
    },
    crest: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: colors.primary,
      backgroundColor: colors.paper,
    },
    crestText: { color: colors.primary, fontSize: 16, fontWeight: "900" },
    teamName: { color: colors.ink, fontSize: 17, fontWeight: "900" },
    teamSummary: { fontSize: 12, color: colors.muted, marginTop: 3 },
    statsLink: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    statsLinkText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
    groupTitle: { fontSize: 15, fontWeight: "900", color: colors.ink, marginTop: 22, marginBottom: 2 },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
    },
    avatarText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
    rowPosition: { fontSize: 11.5, color: colors.muted, marginTop: 2 },
    lineupHint: { color: colors.muted, fontSize: 12.5, lineHeight: 18 },
    tutorRequest: { alignSelf: "flex-start", marginTop: 3, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: "#ef4444" },
    tutorRequestText: { color: "#ffffff", fontSize: 10.5, fontWeight: "800" },
    jersey: { color: colors.muted, opacity: 0.6, fontSize: 26, fontWeight: "900", fontStyle: "italic", marginRight: 4 },
    feedCard: {
      marginTop: 12,
      padding: spacing.md,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      gap: 6,
    },
    feedLabel: { fontSize: 13, fontWeight: "800", color: colors.ink },
    feedHint: { fontSize: 11.5, color: colors.muted, lineHeight: 16 },
    feedRemove: { fontSize: 11, fontWeight: "800", color: colors.muted, marginTop: 2 },
    noTeamLink: { marginTop: 12, padding: 12, backgroundColor: colors.primarySoft, borderRadius: radii.sm },
    noTeamText: { color: colors.primary, fontSize: 11, fontWeight: "800" },
    label: { fontSize: 11, fontWeight: "800", color: colors.ink, marginTop: 24, marginBottom: 9 },
    addRow: { flexDirection: "row", gap: 9 },
    // minWidth: 0 -- sans lui, les deux champs ne rétrécissent pas et poussent « Ajouter » hors de l’écran.
    input: {
      flex: 1,
      minWidth: 0,
      backgroundColor: colors.surface,
      borderColor: colors.line,
      borderWidth: 1,
      borderRadius: radii.sm,
      padding: 12,
      color: colors.ink,
    },
    addButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 18, backgroundColor: colors.primary, borderRadius: radii.sm },
    addButtonText: { color: colors.primaryInk, fontSize: 11, fontWeight: "800" },
    fieldError: { color: colors.danger, fontSize: 10, marginTop: 6 },
    row: {
      marginTop: 10,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radii.md,
      backgroundColor: colors.surface,
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    rowNameLink: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
    rowName: { fontSize: 13, fontWeight: "800", color: colors.ink },
    rowInput: {
      flex: 1,
      minWidth: 120,
      backgroundColor: colors.paper,
      borderColor: colors.line,
      borderWidth: 1,
      borderRadius: radii.sm,
      padding: 9,
      color: colors.ink,
    },
    rowActions: { flexDirection: "row", gap: 7 },
    rowButton: {
      minHeight: 36,
      justifyContent: "center",
      paddingHorizontal: 12,
      backgroundColor: colors.paper,
      borderColor: colors.line,
      borderWidth: 1,
      borderRadius: radii.sm,
    },
    rowButtonText: { fontSize: 10, fontWeight: "800", color: colors.ink },
    empty: { color: colors.muted, fontSize: 11, textAlign: "center", marginTop: 30 },
  }),
);
