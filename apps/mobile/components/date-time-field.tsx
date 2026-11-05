import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { createElement, useState } from "react";
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CalendarIcon, ClockIcon } from "./icons";

type Mode = "date" | "datetime";

export function formatDateTime(value: Date, mode: Mode): string {
  const date = value.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  if (mode === "date") return date;
  return `${date} · ${value.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

// Valeur d’un <input> web (date ou datetime-local) à l’heure locale.
function webValue(value: Date, mode: Mode): string {
  const day = `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  return mode === "date" ? day : `${day}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

// Champ date (et heure) : une pastille lisible avec son icône, qui ouvre le sélecteur natif du
// téléphone — calendrier en ligne sur iOS, boîtes de dialogue date puis heure sur Android. Sur le
// web (captures des fiches store), un <input> natif du navigateur.
export function DateTimeField({
  value,
  onChange,
  mode = "datetime",
  label,
}: {
  value: Date | null;
  onChange: (value: Date) => void;
  mode?: Mode;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(value ?? new Date());

  if (Platform.OS === "web") {
    return createElement("input", {
      "aria-label": label,
      onChange: (event: { target: { value: string } }) => {
        const parsed = new Date(mode === "date" ? `${event.target.value}T00:00:00` : event.target.value);
        if (!Number.isNaN(parsed.getTime())) onChange(parsed);
      },
      style: {
        padding: 12,
        borderRadius: radii.sm,
        border: `1px solid ${colors.line}`,
        background: colors.surface,
        color: colors.ink,
        fontSize: 15,
        colorScheme: "dark",
      },
      type: mode === "date" ? "date" : "datetime-local",
      value: value ? webValue(value, mode) : "",
    });
  }

  function openPicker() {
    const start = value ?? new Date();
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        mode: "date",
        value: start,
        onChange: (event, picked) => {
          if (event.type !== "set" || !picked) return;
          if (mode === "date") {
            onChange(picked);
            return;
          }
          DateTimePickerAndroid.open({
            mode: "time",
            is24Hour: true,
            value: picked,
            onChange: (timeEvent, time) => {
              if (timeEvent.type === "set" && time) onChange(time);
            },
          });
        },
      });
      return;
    }
    setDraft(start);
    setOpen(true);
  }

  return (
    <>
      <TouchableOpacity
        accessibilityLabel={`${label} : ${value ? formatDateTime(value, mode) : "à choisir"}`}
        accessibilityRole="button"
        onPress={openPicker}
        style={styles.field}
      >
        <CalendarIcon color={colors.primary} />
        <Text style={[styles.value, !value && styles.placeholder]}>{value ? formatDateTime(value, mode) : "Choisir une date"}</Text>
        {mode === "datetime" ? <ClockIcon color={colors.muted} size={18} /> : null}
      </TouchableOpacity>

      <Modal animationType="slide" onRequestClose={() => setOpen(false)} transparent visible={open}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.title}>{label}</Text>
            <DateTimePicker
              accentColor={colors.primary}
              display="inline"
              locale="fr-FR"
              mode={mode}
              onChange={(_, picked) => picked && setDraft(picked)}
              themeVariant="dark"
              value={draft}
            />
            <View style={styles.actions}>
              <TouchableOpacity accessibilityRole="button" onPress={() => setOpen(false)} style={styles.cancel}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => {
                  onChange(draft);
                  setOpen(false);
                }}
                style={styles.confirm}
              >
                <Text style={styles.confirmText}>Valider</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  value: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: "700" },
  placeholder: { color: colors.muted, fontWeight: "500" },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(3,6,10,0.7)" },
  sheet: { padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.surface, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg },
  title: { color: colors.ink, fontSize: 17, fontWeight: "900", marginBottom: spacing.sm },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  cancel: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line },
  cancelText: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  confirm: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, backgroundColor: colors.primary },
  confirmText: { color: colors.primaryInk, fontSize: 14, fontWeight: "900" },
});
