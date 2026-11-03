import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { allFormationIds, playStyles } from "@evolyfoot/domain";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState, type ReactNode } from "react";
import { Alert, SafeAreaView, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../lib/auth-context";

interface Profile {
  email: string;
  displayName: string;
  birthDate: string | null;
  club: string | null;
  country: string | null;
  address: string | null;
  phone: string | null;
  diploma: string | null;
  seasonFormat: string | null;
  playStyle: string | null;
  preferredFormation: string | null;
}

type EditableKey = Exclude<keyof Profile, "email">;
type FormState = Record<EditableKey, string>;

interface StaffMember {
  id: string;
  displayName: string;
  email: string;
}

const diplomaOptions = ["Aucun", "Animateur", "CFF1", "CFF2", "CFF3", "CFF4", "BMF", "BEF"];
const seasonFormatOptions = ["Saison partagée (juil.–juin)", "Année civile (janv.–déc.)"];

// Mêmes champs que le profil web. Les listes de choix y sont des suggestions : ici, des pastilles.
const fields: readonly { key: EditableKey; label: string; placeholder?: string; keyboard?: "phone-pad"; options?: readonly string[] }[] = [
  { key: "displayName", label: "Nom" },
  { key: "birthDate", label: "Date de naissance", placeholder: "AAAA-MM-JJ" },
  { key: "club", label: "Club" },
  { key: "country", label: "Pays" },
  { key: "address", label: "Adresse" },
  { key: "phone", label: "Numéro de téléphone", keyboard: "phone-pad" },
  { key: "diploma", label: "Diplôme", options: diplomaOptions },
  { key: "seasonFormat", label: "Format de saison", options: seasonFormatOptions },
  { key: "playStyle", label: "Style de jeu", options: playStyles },
  { key: "preferredFormation", label: "Formation préférée", options: allFormationIds },
];

function toForm(profile: Profile): FormState {
  return Object.fromEntries(fields.map((field) => [field.key, profile[field.key] ?? ""])) as FormState;
}

async function errorOf(response: Response | null, fallback: string): Promise<string> {
  const body = await response?.json().catch(() => null);
  return typeof body?.error === "string" ? body.error : fallback;
}

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.sectionHead}>
        <Text style={styles.cardTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

function StaffSection() {
  const { apiRequest } = useAuth();
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await apiRequest("/api/staff");
    const body = response?.ok ? await response.json().catch(() => null) : null;
    setMembers(body?.members ?? []);
  }, [apiRequest]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function invite() {
    setError("");
    const response = await apiRequest("/api/staff", { method: "POST" });
    if (!response?.ok) {
      setError(await errorOf(response, "Le lien n’a pas pu être créé."));
      return;
    }
    const { url } = await response.json();
    await Share.share({ message: `Rejoins le staff de mon équipe sur EvolyFoot : ${url}` }).catch(() => undefined);
  }

  function remove(member: StaffMember) {
    Alert.alert(`Retirer ${member.displayName} ?`, "Son accès à l’équipe sera supprimé.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Retirer",
        style: "destructive",
        onPress: async () => {
          const response = await apiRequest(`/api/staff/${member.id}`, { method: "DELETE" });
          if (response?.ok) {
            await load();
          } else {
            setError("L’adjoint n’a pas pu être retiré.");
          }
        },
      },
    ]);
  }

  return (
    <Section title="Mon staff">
      <Text style={styles.muted}>Tes adjoints ont leur propre compte. Ils préparent les séances et les matchs et évaluent les joueurs de ton équipe.</Text>
      {members.map((member) => (
        <View key={member.id} style={styles.member}>
          <View style={styles.memberText}>
            <Text style={styles.value}>{member.displayName}</Text>
            <Text numberOfLines={1} style={styles.muted}>
              {member.email}
            </Text>
          </View>
          <TouchableOpacity accessibilityLabel={`Retirer ${member.displayName}`} accessibilityRole="button" onPress={() => remove(member)}>
            <Text style={styles.danger}>Retirer</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity accessibilityRole="button" onPress={invite} style={styles.primary}>
        <Text style={styles.primaryText}>Inviter un adjoint</Text>
      </TouchableOpacity>
      <Text style={styles.muted}>Le lien est valable 7 jours, pour une seule personne. Il donne accès à toute ton équipe.</Text>
      {error ? <Text style={styles.danger}>{error}</Text> : null}
    </Section>
  );
}

export default function ProfilScreen() {
  const { educator, apiRequest, logout } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [passwordMessage, setPasswordMessage] = useState("");

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      apiRequest("/api/profile").then(async (response) => {
        const body = response?.ok ? await response.json().catch(() => null) : null;
        if (cancelled) {
          return;
        }
        if (body?.profile) {
          setProfile(body.profile);
        } else {
          setLoadError("Le profil n’a pas pu être chargé.");
        }
      });
      return () => {
        cancelled = true;
      };
    }, [apiRequest]),
  );

  async function save() {
    if (!form) {
      return;
    }
    if (!form.displayName.trim()) {
      setMessage("Le nom ne peut pas être vide.");
      return;
    }
    setSaving(true);
    const response = await apiRequest("/api/profile", { method: "PATCH", body: JSON.stringify(form) });
    setSaving(false);
    if (!response?.ok) {
      setMessage(await errorOf(response, "L’enregistrement a échoué."));
      return;
    }
    setProfile((await response.json()).profile);
    setForm(null);
    setMessage("Informations enregistrées.");
  }

  async function changePassword() {
    if (passwords.next !== passwords.confirm) {
      setPasswordMessage("La confirmation ne correspond pas au nouveau mot de passe.");
      return;
    }
    const response = await apiRequest("/api/auth/password", {
      method: "PATCH",
      body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.next }),
    });
    if (!response?.ok) {
      setPasswordMessage(await errorOf(response, "Le changement de mot de passe a échoué."));
      return;
    }
    setPasswords({ current: "", next: "", confirm: "" });
    setPasswordMessage("Mot de passe modifié. Tes autres appareils ont été déconnectés.");
  }

  async function signOut() {
    await logout();
    router.replace("/connexion");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <TouchableOpacity accessibilityRole="button" onPress={() => router.back()}>
          <Text style={styles.back}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.step}>{educator?.role === "assistant" ? "ADJOINT" : "MON PROFIL"}</Text>
        <Text style={styles.title}>{profile?.displayName ?? educator?.displayName ?? ""}</Text>
        {loadError ? <Text style={styles.danger}>{loadError}</Text> : null}

        {profile && (
          <Section
            action={
              !form && (
                <TouchableOpacity accessibilityRole="button" onPress={() => (setForm(toForm(profile)), setMessage(""))}>
                  <Text style={styles.link}>Modifier</Text>
                </TouchableOpacity>
              )
            }
            title="Informations personnelles"
          >
            {message ? <Text style={message === "Informations enregistrées." ? styles.success : styles.danger}>{message}</Text> : null}
            {form ? (
              <>
                {fields.map((field) => (
                  <View key={field.key} style={styles.field}>
                    <Text style={styles.label}>{field.label}</Text>
                    <TextInput
                      keyboardType={field.keyboard}
                      onChangeText={(value) => setForm({ ...form, [field.key]: value })}
                      placeholder={field.placeholder}
                      placeholderTextColor={colors.muted}
                      style={styles.input}
                      value={form[field.key]}
                    />
                    {field.options && (
                      <View style={styles.chips}>
                        {field.options.map((option) => (
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityState={{ selected: form[field.key] === option }}
                            key={option}
                            onPress={() => setForm({ ...form, [field.key]: option })}
                            style={[styles.chip, form[field.key] === option && styles.chipActive]}
                          >
                            <Text style={styles.chipText}>{option}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
                <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={save} style={[styles.primary, saving && styles.disabled]}>
                  <Text style={styles.primaryText}>{saving ? "Enregistrement…" : "Enregistrer"}</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" onPress={() => (setForm(null), setMessage(""))} style={styles.ghost}>
                  <Text style={styles.link}>Annuler</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.row}>
                  <Text style={styles.label}>E-mail</Text>
                  <Text style={styles.value}>{profile.email}</Text>
                </View>
                {fields.map((field) => (
                  <View key={field.key} style={styles.row}>
                    <Text style={styles.label}>{field.label}</Text>
                    <Text style={styles.value}>{profile[field.key] || "—"}</Text>
                  </View>
                ))}
              </>
            )}
          </Section>
        )}

        <Section title="Mot de passe">
          {(
            [
              ["current", "Mot de passe actuel", "current-password"],
              ["next", "Nouveau mot de passe (10 caractères minimum)", "new-password"],
              ["confirm", "Confirme le nouveau mot de passe", "new-password"],
            ] as const
          ).map(([key, label, autoComplete]) => (
            <View key={key} style={styles.field}>
              <Text style={styles.label}>{label}</Text>
              <TextInput
                autoComplete={autoComplete}
                onChangeText={(value) => setPasswords({ ...passwords, [key]: value })}
                secureTextEntry
                style={styles.input}
                value={passwords[key]}
              />
            </View>
          ))}
          {passwordMessage ? <Text style={passwordMessage.startsWith("Mot de passe modifié") ? styles.success : styles.danger}>{passwordMessage}</Text> : null}
          <TouchableOpacity
            accessibilityRole="button"
            disabled={!passwords.current || !passwords.next}
            onPress={changePassword}
            style={[styles.primary, (!passwords.current || !passwords.next) && styles.disabled]}
          >
            <Text style={styles.primaryText}>Changer le mot de passe</Text>
          </TouchableOpacity>
        </Section>

        {educator?.role !== "assistant" && <StaffSection />}

        <TouchableOpacity accessibilityRole="button" onPress={signOut} style={styles.ghost}>
          <Text style={styles.link}>Se déconnecter</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.push("/compte")} style={styles.ghost}>
          <Text style={styles.danger}>Supprimer mon compte</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  page: { padding: spacing.lg, paddingBottom: 48 },
  back: { fontSize: 12, fontWeight: "800", color: colors.primary, marginBottom: 14 },
  step: { fontSize: 10, fontWeight: "800", color: colors.primary, letterSpacing: 1.1 },
  title: { fontSize: 28, fontWeight: "800", color: colors.ink, marginTop: 10, marginBottom: 20 },
  card: { padding: spacing.md, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, marginBottom: 12 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: "800", color: colors.ink },
  row: { paddingVertical: 7, borderTopWidth: 1, borderTopColor: colors.line },
  label: { fontSize: 10, fontWeight: "800", color: colors.muted, marginBottom: 4 },
  value: { fontSize: 13, fontWeight: "700", color: colors.ink },
  muted: { fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: 4 },
  link: { fontSize: 12, fontWeight: "800", color: colors.primary },
  danger: { fontSize: 12, fontWeight: "800", color: colors.danger, marginTop: 6 },
  success: { fontSize: 12, fontWeight: "800", color: colors.primary, marginBottom: 6 },
  field: { marginTop: 10 },
  input: { backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1, borderRadius: radii.sm, padding: 12, color: colors.ink },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.line },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { fontSize: 11, fontWeight: "700", color: colors.ink },
  member: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
  memberText: { flex: 1 },
  primary: { minHeight: 46, marginTop: 14, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, backgroundColor: colors.primary },
  primaryText: { color: colors.primaryInk, fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.5 },
  ghost: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 4 },
});
