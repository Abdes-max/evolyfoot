import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { router, usePathname } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { themedStyles } from "../lib/themed-styles";

type StepId = "players" | "season" | "match" | "evaluation" | "session" | "observation" | "result";

interface Guide {
  steps: { id: StepId; done: boolean }[];
  done: number;
  total: number;
  dismissed: boolean;
}

const stepLabels: Record<StepId, { label: string; href: string }> = {
  players: { label: "Ajoute tes joueurs", href: "/equipe" },
  season: { label: "Lance ta saison", href: "/saison" },
  match: { label: "Ajoute un match à venir", href: "/match" },
  evaluation: { label: "Évalue tes joueurs", href: "/equipe" },
  session: { label: "Crée une séance d'entraînement", href: "/seances" },
  observation: { label: "Observe une séance et demande un ajustement", href: "/observation" },
  result: { label: "Marque un match terminé et renseigne les stats", href: "/match" },
};

// Guide de configuration du coach, posé au-dessus de la barre d'onglets : bouton « x/7 » qui ouvre
// la liste des étapes, cochées d'après les données de l'équipe (même API que le web).
export function SetupGuide() {
  const { sessionToken } = useAuth();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [guide, setGuide] = useState<Guide | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!sessionToken) {
      return;
    }
    let cancelled = false;
    apiFetch("/api/setup-guide", { sessionToken })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!cancelled && body?.guide) {
          setGuide(body.guide as Guide);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [sessionToken, pathname, open]);

  const hide = useCallback(async () => {
    setOpen(false);
    setGuide((current) => (current ? { ...current, dismissed: true } : current));
    await apiFetch("/api/setup-guide/dismiss", { method: "POST", sessionToken, body: JSON.stringify({ dismissed: true }) }).catch(() => undefined);
  }, [sessionToken]);

  if (!guide || guide.dismissed) {
    return null;
  }

  const complete = guide.done === guide.total;
  // Au-dessus de la barre d'onglets (56 px + zone de sécurité).
  const bottom = Math.max(insets.bottom, spacing.sm) + 56 + spacing.sm;

  return (
    <View pointerEvents="box-none" style={[styles.root, { bottom }]}>
      {open ? (
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Guide de configuration</Text>
            <TouchableOpacity accessibilityLabel="Fermer" onPress={() => setOpen(false)}>
              <Text style={styles.close}>×</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>{complete ? "Bravo, ton espace est prêt !" : "Mets ton espace en route, étape par étape"}</Text>
          <ScrollView style={{ maxHeight: 340 }}>
            {guide.steps.map((step) => (
              <TouchableOpacity
                accessibilityLabel={`${stepLabels[step.id].label}${step.done ? ", fait" : ""}`}
                key={step.id}
                onPress={() => {
                  setOpen(false);
                  router.push(stepLabels[step.id].href as never);
                }}
                style={styles.step}
              >
                <View style={[styles.check, step.done && styles.checkDone]}>{step.done ? <Text style={styles.checkMark}>✓</Text> : null}</View>
                <Text style={[styles.stepLabel, step.done && styles.stepDone]}>{stepLabels[step.id].label}</Text>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.footer}>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${Math.round((guide.done / guide.total) * 100)}%` }]} />
            </View>
            <Text style={styles.count}>
              {guide.done}/{guide.total}
            </Text>
            <TouchableOpacity onPress={hide} style={styles.hide}>
              <Text style={styles.hideLabel}>{complete ? "Terminer" : "Masquer"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
      <TouchableOpacity accessibilityRole="button" onPress={() => setOpen((value) => !value)} style={styles.toggle}>
        <Text style={styles.toggleLabel}>
          🚀 Guide de configuration {guide.done}/{guide.total}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    root: { position: "absolute", right: spacing.md, left: spacing.md, alignItems: "flex-end", gap: spacing.sm },
    toggle: {
      paddingHorizontal: spacing.md,
      paddingVertical: 11,
      borderRadius: radii.sm + 2,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      shadowColor: "#000",
      shadowOpacity: 0.3,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    toggleLabel: { color: colors.ink, fontSize: 13, fontWeight: "800" },
    card: {
      alignSelf: "stretch",
      padding: spacing.md,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      gap: spacing.sm,
      elevation: 8,
    },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    title: { color: colors.ink, fontSize: 20, fontWeight: "900" },
    close: { color: colors.muted, fontSize: 26, lineHeight: 28 },
    subtitle: { color: colors.muted, fontSize: 13, marginBottom: spacing.xs },
    step: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      marginBottom: spacing.sm,
      borderRadius: radii.sm,
      backgroundColor: colors.primarySoft,
    },
    check: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.muted, alignItems: "center", justifyContent: "center" },
    checkDone: { borderColor: colors.lime, backgroundColor: colors.lime },
    checkMark: { color: colors.primaryInk, fontSize: 13, fontWeight: "900" },
    stepLabel: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: "700" },
    stepDone: { color: colors.muted, textDecorationLine: "line-through" },
    chevron: { color: colors.muted, fontSize: 20 },
    footer: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: spacing.xs },
    bar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.line, overflow: "hidden" },
    barFill: { height: 6, backgroundColor: colors.primary },
    count: { color: colors.ink, fontWeight: "900" },
    hide: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line },
    hideLabel: { color: colors.muted, fontSize: 12 },
  }),
);
