import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { attendanceStatusLabels, attendanceStatusOf, type AttendanceEntry, type AttendanceStatus } from "@evolyfoot/domain";
import { useState } from "react";
import { Modal, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../lib/auth-context";
import { themedStyles } from "../lib/themed-styles";
import { PlayerAvatar } from "./player-avatar";

export interface AttendancePlayer {
  id: string;
  name: string;
  photo?: string | null;
}

// `null` : pas encore de réponse ni de validation.
type RowStatus = AttendanceStatus | null;

// Motifs d'une absence valide (justifiée).
const validAbsenceStatuses: readonly AttendanceStatus[] = ["sick", "injured", "personal"];

function initialRows(players: readonly AttendancePlayer[], attendance: readonly AttendanceEntry[] | undefined): Record<string, RowStatus> {
  const rows: Record<string, RowStatus> = {};
  for (const player of players) {
    const entry = attendance?.find((candidate) => candidate.playerId === player.id);
    rows[player.id] = entry ? attendanceStatusOf(entry) : null;
  }
  return rows;
}

function isParticipating(status: RowStatus): boolean {
  return status === "present" || status === "late";
}

// Une note existe quand le statut précise la présence ou l'absence : « En retard » ou une absence valide.
function noteLabel(status: RowStatus): string | null {
  if (status === "late") return attendanceStatusLabels.late;
  if (status && validAbsenceStatuses.includes(status)) return `Absence valide · ${attendanceStatusLabels[status]}`;
  return null;
}

// Validation des présences une fois l'événement terminé (même écran que le web,
// attendance-validation.tsx) : une carte résumé, puis un écran dédié (Annuler / Sauvegarder) qui
// regroupe les joueurs en « Ont participé », « Sans réponse » et « Absents ». La pastille confirme ou
// retire un joueur ; « + Note » ouvre « Absence valide » (avec son motif) ou « En retard ».
export function AttendanceValidation({
  url,
  players,
  attendance,
  onSaved,
}: {
  // `PUT .../attendance` de l'événement (séance, match, tournoi ou plateau).
  url: string;
  players: readonly AttendancePlayer[];
  attendance: readonly AttendanceEntry[] | undefined;
  // Reçoit le corps de la réponse (l'événement mis à jour).
  onSaved: (body: Record<string, unknown>) => void;
}) {
  const { apiRequest } = useAuth();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(() => initialRows(players, attendance));
  const [note, setNote] = useState<{ playerId: string; step: "root" | "motive" } | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  if (players.length === 0) return null;

  const statusOf = (player: AttendancePlayer): RowStatus => rows[player.id] ?? null;
  const participating = players.filter((player) => isParticipating(statusOf(player)));
  const pending = players.filter((player) => statusOf(player) === null);
  const declined = players.filter((player) => statusOf(player) !== null && !isParticipating(statusOf(player)));
  const late = participating.filter((player) => statusOf(player) === "late").length;
  const notePlayer = note ? players.find((player) => player.id === note.playerId) : undefined;

  function openSheet() {
    setRows(initialRows(players, attendance));
    setNote(null);
    setMessage("");
    setFailed(false);
    setOpen(true);
  }

  function setStatus(playerId: string, status: RowStatus) {
    setRows((current) => ({ ...current, [playerId]: status }));
  }

  async function save() {
    const updates = players.flatMap((player) => {
      const status = statusOf(player);
      return status === null ? [] : [{ playerId: player.id, status }];
    });
    if (updates.length === 0) {
      setFailed(true);
      setMessage("Coche au moins un joueur avant de sauvegarder.");
      return;
    }
    setSaving(true);
    setMessage("");
    setFailed(false);
    const response = await apiRequest(url, { method: "PUT", body: JSON.stringify({ attendance: updates }) });
    const body = response ? await response.json().catch(() => null) : null;
    if (!response?.ok) {
      setFailed(true);
      setMessage(typeof body?.error === "string" ? body.error : "L’enregistrement a échoué, réessaie.");
    } else {
      setOpen(false);
      setMessage("Présences enregistrées.");
      onSaved(body ?? {});
    }
    setSaving(false);
  }

  function renderRow(player: AttendancePlayer) {
    const status = statusOf(player);
    const checked = isParticipating(status);
    const label = noteLabel(status);
    return (
      <View key={player.id} style={styles.row}>
        <PlayerAvatar name={player.name} photo={player.photo} style={styles.avatar} textStyle={styles.avatarText} />
        <View style={styles.rowName}>
          <Text style={styles.name}>{player.name}</Text>
          {label ? <Text style={[styles.status, status === "late" ? styles.statusLate : styles.statusAbsent]}>{label}</Text> : null}
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={() => setNote({ playerId: player.id, step: "root" })} style={styles.noteButton}>
          <Text style={styles.noteText}>{label ? "Note" : "+ Note"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityLabel={`${player.name} : ${checked ? "a participé, appuie pour le retirer" : "appuie pour confirmer sa participation"}`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          onPress={() => setStatus(player.id, checked ? "absent" : "present")}
          style={styles.checkHit}
        >
          <View style={[styles.check, checked && styles.checkOn]}>{checked ? <Text style={styles.checkMark}>✓</Text> : null}</View>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Présences</Text>
      <Text style={styles.hint}>
        {attendance?.length
          ? `${attendance.filter((entry) => entry.present).length} ont participé${late ? ` (dont ${late} en retard)` : ""}. Tu peux encore corriger.`
          : "L’événement est terminé : confirme qui était là."}
      </Text>
      <TouchableOpacity accessibilityRole="button" onPress={openSheet} style={styles.primary}>
        <Text style={styles.primaryText}>Valider les présences</Text>
      </TouchableOpacity>
      {message && !open ? <Text style={failed ? styles.error : styles.feedback}>{message}</Text> : null}

      <Modal animationType="slide" onRequestClose={() => setOpen(false)} presentationStyle="fullScreen" visible={open}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            <TouchableOpacity accessibilityRole="button" onPress={() => setOpen(false)} style={styles.headerAction}>
              <Text style={styles.headerText}>Annuler</Text>
            </TouchableOpacity>
            <Text numberOfLines={1} style={styles.headerTitle}>
              Validation des présences
            </Text>
            <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={() => void save()} style={[styles.headerAction, saving && styles.disabled]}>
              <Text style={[styles.headerText, styles.headerSave]}>{saving ? "…" : "Sauvegarder"}</Text>
            </TouchableOpacity>
          </View>
          {message ? <Text style={[failed ? styles.error : styles.feedback, styles.sheetMessage]}>{message}</Text> : null}
          <ScrollView contentContainerStyle={styles.body}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Ont participé ({participating.length})</Text>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() =>
                  setRows(Object.fromEntries(players.map((player) => [player.id, participating.length === players.length ? "absent" : "present"])))
                }
                style={styles.sectionAction}
              >
                <Text style={[styles.sectionActionText, participating.length === players.length && styles.sectionActionDanger]}>
                  {participating.length === players.length ? "Tout retirer" : "Tout cocher"}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.list}>{participating.map(renderRow)}</View>
            {pending.length > 0 ? (
              <>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>Sans réponse ({pending.length})</Text>
                </View>
                <View style={styles.list}>{pending.map(renderRow)}</View>
              </>
            ) : null}
            {declined.length > 0 ? (
              <>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>Absents ({declined.length})</Text>
                </View>
                <View style={styles.list}>{declined.map(renderRow)}</View>
              </>
            ) : null}
          </ScrollView>

          <Modal animationType="fade" onRequestClose={() => setNote(null)} transparent visible={note !== null && notePlayer !== undefined}>
            <View style={styles.backdrop}>
              <TouchableOpacity accessibilityLabel="Fermer" onPress={() => setNote(null)} style={StyleSheet.absoluteFill} />
              <View style={styles.actionSheet}>
                <View style={styles.actionGroup}>
                  <Text style={styles.actionTitle}>{note?.step === "motive" ? "Motif de l’absence valide" : "Ajouter une note"}</Text>
                  {note?.step === "motive" ? (
                    validAbsenceStatuses.map((motive) => (
                      <TouchableOpacity
                        accessibilityRole="button"
                        key={motive}
                        onPress={() => {
                          if (notePlayer) setStatus(notePlayer.id, motive);
                          setNote(null);
                        }}
                        style={styles.actionOption}
                      >
                        <Text style={styles.actionText}>{attendanceStatusLabels[motive]}</Text>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <>
                      <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => notePlayer && setNote({ playerId: notePlayer.id, step: "motive" })}
                        style={styles.actionOption}
                      >
                        <Text style={styles.actionText}>Absence valide</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => {
                          if (notePlayer) setStatus(notePlayer.id, "late");
                          setNote(null);
                        }}
                        style={styles.actionOption}
                      >
                        <Text style={styles.actionText}>En retard</Text>
                      </TouchableOpacity>
                      {notePlayer && noteLabel(statusOf(notePlayer)) ? (
                        <TouchableOpacity
                          accessibilityRole="button"
                          onPress={() => {
                            setStatus(notePlayer.id, isParticipating(statusOf(notePlayer)) ? "present" : "absent");
                            setNote(null);
                          }}
                          style={styles.actionOption}
                        >
                          <Text style={[styles.actionText, styles.actionDanger]}>Retirer la note</Text>
                        </TouchableOpacity>
                      ) : null}
                    </>
                  )}
                </View>
                <TouchableOpacity accessibilityRole="button" onPress={() => setNote(null)} style={[styles.actionGroup, styles.actionCancel]}>
                  <Text style={[styles.actionText, styles.actionCancelText]}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    wrap: { gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
    title: { color: colors.ink, fontSize: 16, fontWeight: "800" },
    hint: { color: colors.muted, fontSize: 12 },
    primary: { minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, backgroundColor: colors.primary, paddingHorizontal: 12 },
    primaryText: { color: colors.primaryInk, fontSize: 13, fontWeight: "800" },
    disabled: { opacity: 0.5 },
    feedback: { color: colors.primary, fontSize: 12, fontWeight: "700" },
    error: { color: colors.danger, fontSize: 12, fontWeight: "700" },
    safe: { flex: 1, backgroundColor: colors.surface },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    headerAction: { minHeight: 48, minWidth: 64, justifyContent: "center" },
    headerText: { color: colors.ink, fontSize: 15, fontWeight: "600" },
    headerSave: { color: colors.primary, fontWeight: "900", textAlign: "right" },
    headerTitle: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: "800", textAlign: "center" },
    sheetMessage: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
    body: { paddingBottom: 48, backgroundColor: colors.paper },
    sectionHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingTop: 18,
      paddingBottom: 6,
    },
    sectionTitle: { color: colors.muted, fontSize: 12, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
    sectionAction: { minHeight: 44, justifyContent: "center" },
    sectionActionText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
    sectionActionDanger: { color: colors.danger },
    list: { backgroundColor: colors.surface },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      minHeight: 60,
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.line },
    avatarText: { color: colors.muted, fontSize: 13, fontWeight: "800" },
    rowName: { flex: 1, gap: 2 },
    name: { color: colors.ink, fontSize: 15, fontWeight: "700" },
    status: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
    statusLate: { color: "#ffb073" },
    statusAbsent: { color: colors.danger },
    noteButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.line },
    noteText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
    checkHit: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    check: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
    checkOn: { borderColor: colors.primary, backgroundColor: colors.primary },
    checkMark: { color: colors.primaryInk, fontSize: 16, fontWeight: "900" },
    backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(7,11,18,0.45)", padding: 12 },
    actionSheet: { gap: 8 },
    actionGroup: { overflow: "hidden", borderRadius: 14, backgroundColor: colors.surface },
    actionTitle: { padding: 14, color: colors.muted, fontSize: 13, textAlign: "center", borderBottomWidth: 1, borderBottomColor: colors.line },
    actionOption: { minHeight: 52, alignItems: "center", justifyContent: "center", borderBottomWidth: 1, borderBottomColor: colors.line },
    actionText: { color: colors.primary, fontSize: 17 },
    actionDanger: { color: colors.danger },
    actionCancel: { minHeight: 52, alignItems: "center", justifyContent: "center" },
    actionCancelText: { fontWeight: "800" },
  }),
);
