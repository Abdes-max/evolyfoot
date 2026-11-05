import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { PhotoChoice } from "../components/photo-choice";
import { PlayerCard } from "../components/player-card";
import { Screen } from "../components/screen";
import { useAuth } from "../lib/auth-context";
import { buildAgenda, endOfCurrentWeek, useDashboard } from "../lib/dashboard";
import { apiFetch } from "../lib/api";
import { openInMaps } from "../lib/open-in-maps";
import { pickPhoto } from "../lib/photo";
import { markEvaluationsRead } from "../lib/push";

export default function MyCardScreen() {
  const { logout, sessionToken } = useAuth();
  useFocusEffect(
    useCallback(() => {
      if (sessionToken) void markEvaluationsRead(sessionToken);
    }, [sessionToken]),
  );
  const { dashboard, status, reload } = useDashboard();
  const [now] = useState(() => Date.now());
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoChoice, setPhotoChoice] = useState<{ original: string; cutout: string } | null>(null);

  async function savePhoto(photo: string) {
    const response = await apiFetch("/api/joueur/photo", { method: "PUT", sessionToken, body: JSON.stringify({ photo }) }).catch(() => null);
    if (!response?.ok) {
      Alert.alert("La photo n’a pas été enregistrée.", "Réessaie dans un instant.");
      return;
    }
    await reload();
  }

  // Photo choisie dans la galerie, détourée par le serveur ; on propose les deux versions.
  async function changePhoto() {
    setPhotoBusy(true);
    try {
      const photo = await pickPhoto();
      if (!photo) return;
      const response = await apiFetch("/api/photos/detourage", { method: "POST", sessionToken, body: JSON.stringify({ image: photo }) }).catch(() => null);
      const body = response?.ok ? await response.json().catch(() => null) : null;
      if (typeof body?.image === "string") {
        setPhotoChoice({ original: photo, cutout: body.image });
      } else {
        await savePhoto(photo);
      }
    } catch {
      Alert.alert("Impossible de traiter cette image.");
    } finally {
      setPhotoBusy(false);
    }
  }

  function confirmLogout() {
    Alert.alert("Mon compte", undefined, [
      { text: "Annuler", style: "cancel" },
      { text: "Se déconnecter", onPress: logout },
      { text: "Supprimer mon compte", style: "destructive", onPress: () => router.push("/compte") },
    ]);
  }

  const latestCoach = dashboard?.evaluations.find((evaluation) => evaluation.source !== "player");
  // Seulement la semaine en cours : le reste est dans l’onglet Calendrier.
  const agenda = dashboard ? buildAgenda(dashboard, now).filter((event) => event.date && new Date(event.date).getTime() <= endOfCurrentWeek(now)) : [];

  return (
    <Screen
      action={
        <TouchableOpacity accessibilityRole="button" onPress={confirmLogout} style={styles.logout}>
          <Text style={styles.logoutText}>Compte</Text>
        </TouchableOpacity>
      }
      title="Ma carte"
    >
      {status === "loading" && !dashboard ? <Text style={styles.note}>Chargement…</Text> : null}
      {status === "error" && !dashboard ? <Text style={styles.note}>Impossible de charger ta carte. Vérifie ta connexion.</Text> : null}

      {dashboard ? (
        <>
          {dashboard.team ? (
            <Text style={styles.team}>
              {dashboard.team.name} · {dashboard.team.ageGroup}
            </Text>
          ) : null}
          <PlayerCard
            jerseyNumber={dashboard.player.jerseyNumber}
            name={dashboard.player.name}
            photo={dashboard.player.photo}
            position={dashboard.player.position}
            preferredFoot={dashboard.player.preferredFoot}
            scores={latestCoach?.scores ?? null}
            season={dashboard.season}
          />
          <TouchableOpacity accessibilityRole="button" disabled={photoBusy} onPress={() => void changePhoto()} style={styles.photoButton}>
            <Text style={styles.photoButtonText}>{photoBusy ? "Détourage…" : dashboard.player.photo ? "Changer ma photo" : "Ajouter ma photo"}</Text>
          </TouchableOpacity>
          <PhotoChoice
            cutout={photoChoice?.cutout ?? null}
            onCancel={() => setPhotoChoice(null)}
            onChoose={(photo) => {
              setPhotoChoice(null);
              void savePhoto(photo);
            }}
            original={photoChoice?.original ?? null}
          />

          <Text style={styles.section}>Cette semaine</Text>
          {agenda.length === 0 ? <Text style={styles.note}>Rien de prévu cette semaine.</Text> : null}
          {agenda.map((event) => (
            <View key={event.key} style={styles.event}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.eventMeta}>{[event.dateLabel, event.time].filter(Boolean).join(" · ")}</Text>
              {event.location ? (
                <TouchableOpacity
                  accessibilityHint="Ouvre le lieu dans une appli de cartes"
                  accessibilityRole="link"
                  hitSlop={6}
                  onPress={() => void openInMaps(event.location!)}
                >
                  <Text style={styles.eventPlace}>📍 {event.location}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  photoButton: {
    alignSelf: "center",
    marginTop: spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  photoButtonText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  logout: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line },
  logoutText: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  note: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  team: { color: colors.lime, fontSize: 13, fontWeight: "800", textAlign: "center", marginBottom: spacing.sm },
  section: { color: colors.ink, fontSize: 22, fontWeight: "900", textTransform: "uppercase", marginTop: spacing.lg, marginBottom: spacing.sm },
  event: {
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    backgroundColor: colors.surface,
  },
  eventTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  eventMeta: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  eventPlace: { color: colors.primary, fontSize: 12, fontWeight: "800", lineHeight: 18, marginTop: 3, textDecorationLine: "underline" },
});
