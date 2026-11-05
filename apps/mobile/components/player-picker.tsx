import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { playerPositionCodes, playerPositions } from "@evolyfoot/domain";
import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

export interface PickablePlayer {
  id: string;
  name: string;
  position?: string | null;
  jerseyNumber?: string | null;
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("") || "?"
  );
}

function positionLabel(position: string | null | undefined): string {
  if (!position || !(playerPositions as readonly string[]).includes(position)) return "Poste à renseigner";
  return `${position} (${playerPositionCodes[position as keyof typeof playerPositionCodes]})`;
}

// Fenêtre « Choisir un joueur » de la composition, même présentation que sur le web
// (player-picker.tsx) : recherche, puis une ligne par joueur avec son poste et son numéro.
export function PlayerPicker({
  visible,
  title,
  players,
  currentPlayerId,
  statusOf,
  onPick,
  onClear,
  onClose,
}: {
  visible: boolean;
  title: string;
  players: readonly PickablePlayer[];
  currentPlayerId?: string | null;
  statusOf?: (playerId: string) => string | null;
  onPick: (playerId: string) => void;
  onClear?: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase("fr");
  const shown = players.filter((player) => !needle || player.name.toLocaleLowerCase("fr").includes(needle));

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity accessibilityLabel="Fermer" accessibilityRole="button" onPress={onClose} style={styles.close}>
              <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            accessibilityLabel="Rechercher un joueur"
            onChangeText={setQuery}
            placeholder="Rechercher un joueur"
            placeholderTextColor={colors.muted}
            style={styles.search}
            value={query}
          />
          <ScrollView>
            {currentPlayerId && onClear ? (
              <TouchableOpacity accessibilityRole="button" onPress={onClear} style={styles.clear}>
                <Text style={styles.clearText}>Laisser le poste libre</Text>
              </TouchableOpacity>
            ) : null}
            {shown.map((player) => {
              const status = statusOf?.(player.id) ?? null;
              const current = player.id === currentPlayerId;
              return (
                <TouchableOpacity
                  accessibilityLabel={`${player.name}${status ? `, ${status}` : ""}`}
                  accessibilityRole="button"
                  key={player.id}
                  onPress={() => onPick(player.id)}
                  style={[styles.row, current && styles.rowCurrent]}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials(player.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{player.name}</Text>
                    <Text style={styles.meta}>
                      {positionLabel(player.position)}
                      {status ? <Text style={styles.status}> · {status}</Text> : null}
                    </Text>
                  </View>
                  <Text style={styles.number}>{player.jerseyNumber || ""}</Text>
                </TouchableOpacity>
              );
            })}
            {shown.length === 0 ? <Text style={styles.empty}>Aucun joueur ne correspond.</Text> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(3,6,10,0.7)" },
  sheet: {
    maxHeight: "82%",
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  title: { flex: 1, color: colors.ink, fontSize: 17, fontWeight: "900" },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper },
  closeText: { color: colors.ink, fontSize: 20, fontWeight: "700" },
  search: {
    padding: 12,
    marginBottom: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    color: colors.ink,
  },
  clear: { padding: 14, alignItems: "center" },
  clearText: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: radii.sm },
  rowCurrent: { backgroundColor: colors.paper },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
  },
  avatarText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  name: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  status: { color: colors.primary, fontWeight: "800" },
  number: { color: "rgba(255,255,255,0.28)", fontSize: 24, fontWeight: "900", fontStyle: "italic" },
  empty: { color: colors.muted, fontSize: 13, textAlign: "center", padding: spacing.md },
});
