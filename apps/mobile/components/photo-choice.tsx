import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

// Choix proposé après le détourage : la même photo sans et avec le fond, sur le fond de la carte
// joueur, pour voir le rendu avant d’enregistrer (même écran que le web, photo-choice.tsx).
export function PhotoChoice({
  original,
  cutout,
  onChoose,
  onCancel,
}: {
  original: string | null;
  cutout: string | null;
  onChoose: (photo: string) => void;
  onCancel: () => void;
}) {
  return (
    <Modal animationType="slide" onRequestClose={onCancel} transparent visible={Boolean(original && cutout)}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Fond retiré automatiquement</Text>
          <Text style={styles.hint}>Quelle version garder pour la carte joueur ?</Text>
          <View style={styles.options}>
            {(
              [
                [cutout, "Sans fond"],
                [original, "Avec le fond"],
              ] as const
            ).map(([photo, label]) =>
              photo ? (
                <TouchableOpacity accessibilityLabel={label} accessibilityRole="button" key={label} onPress={() => onChoose(photo)} style={styles.option}>
                  <Image resizeMode="contain" source={{ uri: photo }} style={styles.image} />
                  <Text style={styles.label}>{label}</Text>
                </TouchableOpacity>
              ) : null,
            )}
          </View>
          <TouchableOpacity accessibilityRole="button" onPress={onCancel} style={styles.cancel}>
            <Text style={styles.cancelText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(3,6,10,0.7)" },
  sheet: { padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.surface, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg },
  title: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  hint: { color: colors.muted, fontSize: 13, marginTop: 4, marginBottom: spacing.md },
  options: { flexDirection: "row", gap: spacing.sm },
  option: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    backgroundColor: colors.primarySoft,
  },
  image: { width: "100%", aspectRatio: 1 },
  label: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  cancel: { alignSelf: "center", marginTop: spacing.md, padding: spacing.sm },
  cancelText: { color: colors.muted, fontSize: 14, fontWeight: "800" },
});
