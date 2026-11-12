import { colors, radii, spacing } from "@evolyfoot/design-tokens";
import { allFormationIds, diagnosticCriteria, playStyles, type DiagnosticScores } from "@evolyfoot/domain";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Alert, Linking, SafeAreaView, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { ConvocationSettings } from "../components/convocation-settings";
import { ThemeToggle } from "../components/theme-toggle";
import { apiBaseUrl } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { themedStyles } from "../lib/themed-styles";

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

interface TeamChoice {
  id: string;
  name: string | null;
  ageGroup: string | null;
  primary: boolean;
  active: boolean;
}

function teamLabel(team: TeamChoice): string {
  if (!team.name) {
    return "Nouvelle équipe (à configurer)";
  }
  return team.ageGroup ? `${team.name} · ${team.ageGroup}` : team.name;
}

interface ClubInfo {
  name: string;
  joinCode: string;
  members: { id: string; displayName: string }[];
}

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

// Comme le bloc « Mes équipes » du profil web : chaque équipe a son effectif, ses séances, ses
// matchs et son staff ; l'équipe ouverte vaut pour toute l'appli.
function TeamsSection() {
  const { apiRequest, reloadTeamData } = useAuth();
  const [teams, setTeams] = useState<TeamChoice[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await apiRequest("/api/teams");
    const body = response?.ok ? await response.json().catch(() => null) : null;
    setTeams(Array.isArray(body?.teams) ? body.teams : []);
  }, [apiRequest]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function open(team: TeamChoice) {
    setError("");
    const response = await apiRequest("/api/teams/active", { method: "PUT", body: JSON.stringify({ id: team.id }) });
    if (!response?.ok) {
      setError(await errorOf(response, "L’équipe n’a pas pu être ouverte."));
      return;
    }
    await reloadTeamData();
    router.replace("/");
  }

  async function add() {
    setError("");
    const response = await apiRequest("/api/teams", { method: "POST" });
    if (!response?.ok) {
      setError(await errorOf(response, "L’équipe n’a pas pu être créée."));
      return;
    }
    await reloadTeamData();
    router.push("/onboarding");
  }

  function remove(team: TeamChoice) {
    Alert.alert(`Supprimer ${teamLabel(team)} ?`, "Son effectif, ses séances, ses matchs et son staff seront supprimés définitivement.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          const response = await apiRequest(`/api/teams/${team.id}`, { method: "DELETE" });
          if (!response?.ok) {
            setError(await errorOf(response, "L’équipe n’a pas pu être supprimée."));
            return;
          }
          if (team.active) {
            await reloadTeamData();
          }
          await load();
        },
      },
    ]);
  }

  return (
    <Section title="Mes équipes">
      <Text style={styles.muted}>Chaque équipe a son effectif, ses séances, ses matchs et son staff.</Text>
      {teams.map((team) => (
        <View key={team.id} style={styles.member}>
          <View style={styles.memberText}>
            <Text style={styles.value}>{teamLabel(team)}</Text>
            <Text style={styles.muted}>{team.active ? "Équipe affichée" : team.primary ? "Première équipe" : "Équipe ajoutée"}</Text>
          </View>
          {!team.active && (
            <TouchableOpacity accessibilityLabel={`Ouvrir ${teamLabel(team)}`} accessibilityRole="button" onPress={() => open(team)}>
              <Text style={styles.link}>Ouvrir</Text>
            </TouchableOpacity>
          )}
          {!team.primary && (
            <TouchableOpacity accessibilityLabel={`Supprimer ${teamLabel(team)}`} accessibilityRole="button" onPress={() => remove(team)}>
              <Text style={styles.danger}>Supprimer</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      <TouchableOpacity accessibilityRole="button" onPress={add} style={styles.primary}>
        <Text style={styles.primaryText}>Ajouter une équipe</Text>
      </TouchableOpacity>
      {error ? <Text style={styles.danger}>{error}</Text> : null}
    </Section>
  );
}

// Comme le bloc « Mon club » du profil web : les membres voient les exercices personnels des
// autres dans la bibliothèque. `undefined` tant que le club n'est pas chargé, `null` hors club.
function ClubSection() {
  const { apiRequest } = useAuth();
  const [club, setClub] = useState<ClubInfo | null | undefined>(undefined);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await apiRequest("/api/club");
    const body = response?.ok ? await response.json().catch(() => null) : null;
    setClub(response?.ok ? (body?.club ?? null) : undefined);
  }, [apiRequest]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function save(body: { code: string } | { name: string }) {
    setError("");
    const response = await apiRequest("/api/club", { method: "POST", body: JSON.stringify(body) });
    if (!response?.ok) {
      setError(await errorOf(response, "Le club n’a pas pu être enregistré."));
      return;
    }
    const result = await response.json().catch(() => null);
    setClub(result?.club ?? null);
    setCode("");
    setName("");
  }

  function share(current: ClubInfo) {
    Share.share({ message: `Rejoins le club « ${current.name} » sur EvolyFoot (Profil › Mon club) avec le code ${current.joinCode}` }).catch(() => undefined);
  }

  function leave() {
    Alert.alert("Quitter le club ?", "Tes exercices ne seront plus partagés et tu ne verras plus ceux des autres membres.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Quitter",
        style: "destructive",
        onPress: async () => {
          const response = await apiRequest("/api/club", { method: "DELETE" });
          if (response?.ok) {
            setClub(null);
          } else {
            setError("Tu n’as pas pu quitter le club.");
          }
        },
      },
    ]);
  }

  if (club === undefined) {
    return null;
  }

  return (
    <Section title="Mon club">
      {club ? (
        <>
          <Text style={styles.muted}>
            Les éducateurs de {club.name} voient tes exercices personnels, ceux de toutes tes équipes, et peuvent les copier. Tu vois les leurs dans la
            bibliothèque.
          </Text>
          {club.members.map((member) => (
            <View key={member.id} style={styles.member}>
              <Text style={styles.value}>{member.displayName}</Text>
            </View>
          ))}
          <View style={styles.row}>
            <Text style={styles.label}>CODE DU CLUB</Text>
            <Text selectable style={styles.value}>
              {club.joinCode}
            </Text>
          </View>
          <TouchableOpacity accessibilityRole="button" onPress={() => share(club)} style={styles.primary}>
            <Text style={styles.primaryText}>Partager le code</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={leave} style={styles.ghost}>
            <Text style={styles.danger}>Quitter le club</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.muted}>
            Partage tes exercices avec les autres éducateurs de ton club. Rejoins le club d’un collègue avec son code, ou crée-le.
          </Text>
          <TextInput
            accessibilityLabel="Code d’un club"
            autoCapitalize="characters"
            onChangeText={setCode}
            placeholder="Code reçu d’un collègue"
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.field]}
            value={code}
          />
          <TouchableOpacity
            accessibilityRole="button"
            disabled={!code.trim()}
            onPress={() => save({ code })}
            style={[styles.primary, !code.trim() && styles.disabled]}
          >
            <Text style={styles.primaryText}>Rejoindre</Text>
          </TouchableOpacity>
          <TextInput
            accessibilityLabel="Nom du club"
            onChangeText={setName}
            placeholder="Nom du club"
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.field]}
            value={name}
          />
          <TouchableOpacity
            accessibilityRole="button"
            disabled={!name.trim()}
            onPress={() => save({ name })}
            style={[styles.ghost, !name.trim() && styles.disabled]}
          >
            <Text style={styles.link}>Créer le club</Text>
          </TouchableOpacity>
        </>
      )}
      {error ? <Text style={styles.danger}>{error}</Text> : null}
    </Section>
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
      <Text style={styles.muted}>
        Tes adjoints ont leur propre compte. Ils préparent les séances et les matchs et évaluent les joueurs de l’équipe affichée : chaque équipe a son propre
        staff.
      </Text>
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

// Onglets du profil, comme sur le web : informations et accès, équipe, ce qui oriente la saison, options.
const profileTabs = [
  { id: "profil", label: "Profil" },
  { id: "equipe", label: "Équipe" },
  { id: "saison", label: "Ma saison" },
  { id: "options", label: "Options" },
] as const;
type ProfileTab = (typeof profileTabs)[number]["id"];

// Champs « À définir » mis en avant tant qu'ils sont vides (comme le web).
const todoFields: readonly EditableKey[] = ["diploma", "playStyle", "preferredFormation"];

function initials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  return parts.length
    ? parts
        .slice(0, 2)
        .map((part) => part[0]!.toUpperCase())
        .join("")
    : "?";
}

function formatBirthDate(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

type BillingAccess = { state: "subscribed" } | { state: "trial"; daysLeft: number } | { state: "expired" };

function billingLabel(access: BillingAccess, cancelAt: string | null): string {
  if (access.state === "subscribed") return cancelAt ? "Abonnement résilié" : "Abonnement actif";
  if (access.state === "trial") {
    const plural = access.daysLeft > 1 ? "s" : "";
    return `Essai gratuit : ${access.daysLeft} jour${plural} restant${plural}`;
  }
  return "Essai terminé";
}

// Bannière du profil : identité et encart d'abonnement. L'abonnement se prend et se gère sur le site.
function ProfileBanner({ displayName }: { displayName: string }) {
  const { apiRequest } = useAuth();
  const [billing, setBilling] = useState<{ access: BillingAccess; cancelAt: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiRequest("/api/billing").then(async (response) => {
      const body = response?.ok ? await response.json().catch(() => null) : null;
      if (!cancelled && body?.billing) setBilling(body.billing);
    });
    return () => {
      cancelled = true;
    };
  }, [apiRequest]);

  const subscribed = billing?.access.state === "subscribed";
  return (
    <View style={styles.banner}>
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(displayName)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerName}>{displayName}</Text>
          <Text accessibilityLabel="Note du profil : indicative" style={styles.rating}>
            ★★☆☆☆
          </Text>
        </View>
      </View>
      <View style={styles.plan}>
        <Text style={styles.planName}>{subscribed ? "ABONNEMENT COACH" : "ESSAI GRATUIT"}</Text>
        <Text style={styles.planNote}>{billing ? billingLabel(billing.access, billing.cancelAt) : "…"}</Text>
        <TouchableOpacity accessibilityRole="link" onPress={() => Linking.openURL(`${apiBaseUrl()}/abonnement`)} style={styles.planCta}>
          <Text style={styles.planCtaText}>{subscribed ? "Mon abonnement" : "S’abonner"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Onglet « Ma saison » : priorités de la saison guidée, dernier diagnostic, planning et convocations.
function SeasonTab() {
  const { apiRequest } = useAuth();
  const [data, setData] = useState<{ priorities: string[] | null; scores: DiagnosticScores | null; trainingDays: string[] } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all(
        ["/api/season-program", "/api/diagnostic", "/api/team"].map((path) =>
          apiRequest(path).then((response) => (response?.ok ? response.json().catch(() => null) : null)),
        ),
      ).then(([program, diagnostic, team]) => {
        if (cancelled) return;
        setData({
          priorities: program?.program?.priorities ?? null,
          scores: diagnostic?.scores ?? null,
          trainingDays: team?.profile?.trainingDays ?? [],
        });
      });
      return () => {
        cancelled = true;
      };
    }, [apiRequest]),
  );

  if (!data) return <Text style={styles.muted}>Chargement…</Text>;
  const editButton = (label: string, href: "/saison" | "/diagnostic" | "/onboarding") => (
    <TouchableOpacity accessibilityRole="button" onPress={() => router.push(href)} style={styles.edit}>
      <Text style={styles.editText}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <>
      <Section action={editButton("Modifier", "/saison")} title="PRIORITÉS DE LA SAISON">
        {data.priorities?.length ? (
          <View style={styles.chips}>
            {data.priorities.map((priority) => (
              <View key={priority} style={styles.chip}>
                <Text style={styles.chipText}>{priority}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.muted}>Pas encore de saison guidée : choisis tes priorités depuis la page Saison.</Text>
        )}
      </Section>
      <Section action={editButton(data.scores ? "Refaire" : "Faire le diagnostic", "/diagnostic")} title="DIAGNOSTIC DE L’ÉQUIPE">
        {data.scores ? (
          diagnosticCriteria.map((criterion) => {
            const score = data.scores?.[criterion.id];
            return typeof score === "number" ? (
              <View key={criterion.id} style={styles.cell}>
                <Text style={styles.label}>{criterion.label.toUpperCase()}</Text>
                <Text style={styles.value}>{score}/4</Text>
              </View>
            ) : null;
          })
        ) : (
          <Text style={styles.muted}>Aucun diagnostic pour l’instant.</Text>
        )}
      </Section>
      <Section action={editButton("Modifier", "/onboarding")} title="PLANNING D’ENTRAÎNEMENT">
        {data.trainingDays.length ? (
          <View style={styles.chips}>
            {data.trainingDays.map((day) => (
              <View key={day} style={styles.chip}>
                <Text style={styles.chipText}>{day}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.muted}>Aucun jour d’entraînement renseigné.</Text>
        )}
      </Section>
      <ConvocationSettings />
    </>
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
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [tab, setTab] = useState<ProfileTab>("profil");

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
    setPasswordOpen(false);
    setPasswordMessage("Mot de passe modifié. Tes autres appareils ont été déconnectés.");
  }

  async function signOut() {
    await logout();
    router.replace("/connexion");
  }

  const displayName = profile?.displayName ?? educator?.displayName ?? "";
  const isCoach = educator?.role !== "assistant";
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.step}>MON COMPTE</Text>
            <Text style={styles.title}>Profil</Text>
            <Text style={styles.subtitle}>Tes informations d’éducateur et l’accès à ton compte.</Text>
          </View>
          <ThemeToggle />
        </View>
        {loadError ? <Text style={styles.danger}>{loadError}</Text> : null}

        <ProfileBanner displayName={displayName} />

        <View accessibilityRole="tablist" style={styles.tabs}>
          {profileTabs.map((item) => (
            <TouchableOpacity
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === item.id }}
              key={item.id}
              onPress={() => setTab(item.id)}
              style={[styles.tab, tab === item.id && styles.tabActive]}
            >
              <Text style={[styles.tabText, tab === item.id && styles.tabTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === "profil" && profile && (
          <Section
            action={
              !form && (
                <TouchableOpacity accessibilityRole="button" onPress={() => (setForm(toForm(profile)), setMessage(""))} style={styles.edit}>
                  <Text style={styles.editText}>Modifier</Text>
                </TouchableOpacity>
              )
            }
            title="INFORMATIONS PERSONNELLES"
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
                {fields.map((field) => {
                  const value = field.key === "birthDate" ? formatBirthDate(profile.birthDate) : profile[field.key];
                  const todo = !profile[field.key] && todoFields.includes(field.key);
                  return (
                    <View key={field.key} style={styles.cell}>
                      <Text style={styles.label}>{field.label.toUpperCase()}</Text>
                      <Text style={[styles.value, todo && styles.todo]}>{todo ? "À définir" : value || "—"}</Text>
                    </View>
                  );
                })}
                <View style={styles.cell}>
                  <Text style={styles.label}>E-MAIL</Text>
                  <Text style={styles.value}>{profile.email}</Text>
                </View>
              </>
            )}
          </Section>
        )}

        {tab === "profil" && (
          <Section title="ACCÈS AU COMPTE">
            {passwordMessage && !passwordOpen ? <Text style={styles.success}>{passwordMessage}</Text> : null}
            {passwordOpen ? (
              <>
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
                {passwordMessage ? (
                  <Text style={passwordMessage.startsWith("Mot de passe modifié") ? styles.success : styles.danger}>{passwordMessage}</Text>
                ) : null}
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={!passwords.current || !passwords.next}
                  onPress={changePassword}
                  style={[styles.primary, (!passwords.current || !passwords.next) && styles.disabled]}
                >
                  <Text style={styles.primaryText}>Changer le mot de passe</Text>
                </TouchableOpacity>

                <TouchableOpacity accessibilityRole="button" onPress={() => (setPasswordOpen(false), setPasswordMessage(""))} style={styles.ghost}>
                  <Text style={styles.link}>Annuler</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.accountActions}>
                <TouchableOpacity accessibilityRole="button" onPress={() => (setPasswordOpen(true), setPasswordMessage(""))} style={styles.edit}>
                  <Text style={styles.editText}>Réinitialiser le mot de passe</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" onPress={signOut} style={styles.edit}>
                  <Text style={[styles.editText, styles.mutedText]}>Se déconnecter</Text>
                </TouchableOpacity>
              </View>
            )}
          </Section>
        )}

        {tab === "equipe" && isCoach && <TeamsSection />}
        {tab === "equipe" && isCoach && <StaffSection />}
        {tab === "equipe" && isCoach && <ClubSection />}
        {tab === "equipe" && !isCoach && <Text style={styles.muted}>L’équipe est gérée par l’éducateur principal.</Text>}

        {tab === "saison" && <SeasonTab />}

        {tab === "options" && (
          <Section title="MES DONNÉES">
            <Text style={styles.muted}>
              {isCoach
                ? "Supprimer ton compte efface définitivement tes équipes, tes joueurs, tes séances, tes matchs et les comptes liés."
                : "Supprimer ton compte retire ton accès. L’équipe reste chez l’éducateur."}
            </Text>
            <TouchableOpacity accessibilityRole="button" onPress={() => router.push("/compte")} style={styles.ghost}>
              <Text style={styles.danger}>Supprimer mon compte</Text>
            </TouchableOpacity>
          </Section>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.paper },
    page: { padding: spacing.lg, paddingBottom: 48 },
    back: { fontSize: 12, fontWeight: "800", color: colors.primary, marginBottom: 14 },
    step: { fontSize: 10, fontWeight: "800", color: colors.primary, letterSpacing: 1.1 },
    title: { fontSize: 28, fontWeight: "800", color: colors.ink, marginTop: 10, marginBottom: 20 },
    card: { padding: spacing.md, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, marginBottom: 12 },
    sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    cardTitle: { fontSize: 14, fontWeight: "800", color: colors.ink, textTransform: "uppercase", letterSpacing: 0.5, flexShrink: 1 },
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
    header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 18 },
    subtitle: { fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: -14 },
    banner: { padding: spacing.lg, borderRadius: 18, backgroundColor: colors.primary, gap: 18, marginBottom: 14 },
    identity: { flexDirection: "row", alignItems: "center", gap: 14 },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.16)",
      borderWidth: 2,
      borderColor: "rgba(255,255,255,0.4)",
    },
    avatarText: { fontSize: 18, fontWeight: "800", color: colors.primaryInk },
    bannerName: { fontSize: 20, fontWeight: "800", color: colors.primaryInk },
    rating: { fontSize: 13, letterSpacing: 2, color: colors.primaryInk, opacity: 0.85 },
    plan: { alignItems: "flex-start", gap: 4 },
    planName: { fontSize: 13, fontWeight: "800", letterSpacing: 0.6, color: colors.primaryInk },
    planNote: { fontSize: 11, color: colors.primaryInk, opacity: 0.85 },
    planCta: {
      marginTop: 6,
      minHeight: 38,
      paddingHorizontal: 16,
      borderRadius: 99,
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.9)",
    },
    planCtaText: { fontSize: 11, fontWeight: "800", color: "#0b5f82" },
    tabs: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
    tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
    tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabText: { fontSize: 13, fontWeight: "700", color: colors.muted },
    tabTextActive: { color: colors.primaryInk },
    edit: {
      minHeight: 34,
      paddingHorizontal: 14,
      justifyContent: "center",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
    },
    editText: { fontSize: 11, fontWeight: "800", color: colors.ink },
    mutedText: { color: colors.muted },
    cell: { padding: 13, marginTop: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
    todo: { color: colors.primary, fontWeight: "800" },
    accountActions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  }),
);
