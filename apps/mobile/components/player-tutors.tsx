import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../lib/auth-context";

interface Tutor {
  accountId: string;
  displayName: string;
  email: string;
}

interface TutorRequest {
  id: string;
  displayName: string;
  email: string;
}

// Tuteurs d'un joueur (même bloc que le web, tutor-access.tsx) : demandes reçues par le lien
// d'invitation à accepter ou refuser, comptes associés à retirer.
export function PlayerTutors({ playerId }: { playerId: string }) {
  const { apiRequest } = useAuth();
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [requests, setRequests] = useState<TutorRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const path = `/api/roster/${encodeURIComponent(playerId)}/tuteurs`;

  // Rechargée à chaque retour sur la fiche : une demande arrivée entre-temps apparaît aussitôt.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const response = await apiRequest(path);
        const body = response?.ok ? await response.json().catch(() => null) : null;
        if (cancelled || !body) return;
        setTutors(body.tutors ?? []);
        setRequests(body.requests ?? []);
      })();
      return () => {
        cancelled = true;
      };
    }, [apiRequest, path]),
  );

  async function update(method: "POST" | "DELETE", body: Record<string, unknown>) {
    setBusy(true);
    const response = await apiRequest(path, { method, body: JSON.stringify(body) });
    setBusy(false);
    const list = response?.ok ? await response.json().catch(() => null) : null;
    if (!list) {
      Alert.alert("La modification n’a pas été enregistrée, réessaie.");
      return;
    }
    setTutors(list.tutors ?? []);
    setRequests(list.requests ?? []);
  }

  function confirmRemove(tutor: Tutor) {
    Alert.alert(`Retirer ${tutor.displayName} ?`, "Il ne verra plus le suivi de ce joueur.", [
      { text: "Annuler", style: "cancel" },
      { text: "Retirer", style: "destructive", onPress: () => void update("DELETE", { accountId: tutor.accountId }) },
    ]);
  }

  return (
    <View style={styles.block}>
      {requests.length > 0 ? (
        <>
          <Text style={styles.title}>Demandes en attente</Text>
          {requests.map((request) => (
            <View key={request.id} style={styles.row}>
              <View style={styles.identity}>
                <Text style={styles.name}>{request.displayName}</Text>
                <Text style={styles.email}>{request.email}</Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                disabled={busy}
                onPress={() => void update("POST", { requestId: request.id, accept: true })}
                style={styles.accept}
              >
                <Text style={styles.acceptText}>Accepter</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => void update("POST", { requestId: request.id, accept: false })}>
                <Text style={styles.refuse}>Refuser</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      ) : null}
      <Text style={styles.title}>Tuteurs associés</Text>
      {tutors.length === 0 ? (
        <Text style={styles.email}>Aucun compte n’a encore accès au suivi de ce joueur.</Text>
      ) : (
        tutors.map((tutor) => (
          <View key={tutor.accountId} style={styles.row}>
            <View style={styles.identity}>
              <Text style={styles.name}>{tutor.displayName}</Text>
              <Text style={styles.email}>{tutor.email}</Text>
            </View>
            <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => confirmRemove(tutor)}>
              <Text style={styles.refuse}>Retirer</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm, marginTop: spacing.md },
  title: { color: colors.ink, fontSize: 14, fontWeight: "900", marginTop: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  identity: { flex: 1, minWidth: 0 },
  name: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  email: { color: colors.muted, fontSize: 12 },
  accept: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: radii.sm, backgroundColor: colors.primary },
  acceptText: { color: colors.primaryInk, fontSize: 12, fontWeight: "900" },
  refuse: { color: colors.danger, fontSize: 12, fontWeight: "800", paddingHorizontal: 4 },
});
