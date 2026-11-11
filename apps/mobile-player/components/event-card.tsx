import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import type { ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { AgendaEvent } from "../lib/dashboard";
import { openInMaps } from "../lib/open-in-maps";
import { themedStyles } from "../lib/themed-styles";

export const kindLabels: Record<AgendaEvent["kind"], string> = { match: "MATCH", training: "ENTRAÎNEMENT", tournament: "TOURNOI", plateau: "PLATEAU" };

// Carte d'un match, d'une séance ou d'une compétition : bloc date, type, titre, heure et lieu (lien vers
// les cartes). Partagée par l'onglet Calendrier, qui y ajoute la réponse présent / absent en `children`,
// et par « Ma carte », qui n'affiche que le rendez-vous.
export function EventCard({ event, children }: { event: AgendaEvent; children?: ReactNode }) {
  const day = event.date ? new Date(event.date) : null;
  return (
    <View style={styles.event}>
      <View style={styles.row}>
        <View style={styles.dateBlock}>
          <Text style={styles.dateMonth}>{day ? day.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "").toUpperCase() : "—"}</Text>
          <Text style={styles.dateDay}>{day ? day.getDate() : "?"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          {/* Le titre d'un entraînement est déjà « Entraînement » : pas de surtitre en double. */}
          {event.kind === "training" ? null : <Text style={styles.kind}>{kindLabels[event.kind]}</Text>}
          {event.cancelled ? <Text style={styles.cancelled}>ANNULÉ</Text> : null}
          <Text style={[styles.title, event.cancelled && styles.titleCancelled]}>{event.title}</Text>
          {event.cancelled && event.cancellationNote ? <Text style={styles.cancelNote}>{event.cancellationNote}</Text> : null}
          <Text style={styles.meta}>{[event.dateLabel, event.time].filter(Boolean).join(" · ")}</Text>
          {event.location ? (
            <TouchableOpacity accessibilityRole="link" onPress={() => void openInMaps(event.location!)} style={styles.place}>
              <Text style={styles.placeText}>{event.location}</Text>
              <Text style={styles.placeLink}>Y aller (Plans, Google Maps, Waze…) →</Text>
            </TouchableOpacity>
          ) : null}
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    event: {
      padding: spacing.md,
      marginBottom: spacing.md,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.primaryDark,
      backgroundColor: colors.surface,
    },
    row: { flexDirection: "row", gap: spacing.md },
    dateBlock: { width: 52, alignItems: "center", paddingTop: 2 },
    dateMonth: { color: colors.muted, fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
    dateDay: { color: colors.ink, fontSize: 28, fontWeight: "900", lineHeight: 32 },
    kind: { color: colors.lime, fontSize: 11, fontWeight: "900" },
    title: { color: colors.ink, fontSize: 17, fontWeight: "800", marginTop: 3 },
    titleCancelled: { textDecorationLine: "line-through", color: colors.muted },
    cancelled: { color: colors.danger, fontSize: 11, fontWeight: "900" },
    cancelNote: { color: colors.ink, fontSize: 13, lineHeight: 18, marginTop: 3 },
    meta: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
    place: { minHeight: 44, marginTop: spacing.sm, padding: spacing.sm, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.primaryDark },
    placeText: { color: colors.ink, fontSize: 13, fontWeight: "700" },
    placeLink: { color: colors.primary, fontSize: 12, fontWeight: "800", marginTop: 2 },
  }),
);
