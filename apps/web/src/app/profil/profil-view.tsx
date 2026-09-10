"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface Profile {
  id: string;
  email: string;
  displayName: string;
  birthDate: string | null;
  club: string | null;
  country: string | null;
  address: string | null;
  phone: string | null;
  diploma: string | null;
  seasonFormat: string | null;
  createdAt: string;
}

type EditableKey = "displayName" | "birthDate" | "club" | "country" | "address" | "phone" | "diploma" | "seasonFormat";

// Purement déclaratif côté client (le serveur accepte toute chaîne courte) : sert juste à proposer
// des valeurs cohérentes.
const seasonFormatOptions = ["Saison partagée (juil.–juin)", "Année civile (janv.–déc.)"];
const diplomaOptions = ["Aucun", "Animateur", "CFF1", "CFF2", "CFF3", "CFF4", "BMF", "BEF"];

const fields: ReadonlyArray<{ key: EditableKey; label: string; type: "text" | "date" | "tel"; options?: string[] }> = [
  { key: "displayName", label: "Nom", type: "text" },
  { key: "birthDate", label: "Date de naissance", type: "date" },
  { key: "club", label: "Club", type: "text" },
  { key: "country", label: "Pays", type: "text" },
  { key: "address", label: "Adresse", type: "text" },
  { key: "phone", label: "Numéro de téléphone", type: "tel" },
  { key: "diploma", label: "Diplôme", type: "text", options: diplomaOptions },
  { key: "seasonFormat", label: "Format de saison", type: "text", options: seasonFormatOptions },
];

function initials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

function formatBirthDate(value: string | null): string {
  if (!value) {
    return "—";
  }
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

type FormState = Record<EditableKey, string>;

function toForm(profile: Profile): FormState {
  return {
    displayName: profile.displayName,
    birthDate: profile.birthDate ?? "",
    club: profile.club ?? "",
    country: profile.country ?? "",
    address: profile.address ?? "",
    phone: profile.phone ?? "",
    diploma: profile.diploma ?? "",
    seasonFormat: profile.seasonFormat ?? "",
  };
}

export function ProfilView() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unauthenticated" | "error">("loading");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwDone, setPwDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const sessionResponse = await fetch("/api/auth/session");
        const sessionBody = await sessionResponse.json().catch(() => ({ educator: null }));
        if (cancelled) {
          return;
        }
        if (!sessionBody.educator) {
          setStatus("unauthenticated");
          return;
        }
        const response = await fetch("/api/profile");
        const body = await response.json().catch(() => ({ profile: null }));
        if (cancelled) {
          return;
        }
        if (!response.ok || !body.profile) {
          setStatus("error");
          return;
        }
        setProfile(body.profile);
        setStatus("ready");
      } catch {
        if (!cancelled) {
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const seasonLabel = useMemo(() => profile?.seasonFormat ?? "Non renseigné", [profile]);

  function startEditing() {
    if (!profile) {
      return;
    }
    setForm(toForm(profile));
    setSaveError("");
    setSaved(false);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setForm(null);
    setSaveError("");
  }

  function updateField(key: EditableKey, value: string) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!form) {
      return;
    }
    if (!form.displayName.trim()) {
      setSaveError("Le nom ne peut pas être vide.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSaveError(typeof body.error === "string" ? body.error : "L’enregistrement a échoué.");
        return;
      }
      setProfile(body.profile);
      setEditing(false);
      setForm(null);
      setSaved(true);
    } catch {
      setSaveError("L’enregistrement a échoué, réessaie.");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setPwError("");
    setPwDone(false);
    if (pwNew !== pwConfirm) {
      setPwError("La confirmation ne correspond pas au nouveau mot de passe.");
      return;
    }
    setPwSaving(true);
    try {
      const response = await fetch("/api/auth/password", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPwError(typeof body.error === "string" ? body.error : "Le changement de mot de passe a échoué.");
        return;
      }
      setPwCurrent("");
      setPwNew("");
      setPwConfirm("");
      setPwOpen(false);
      setPwDone(true);
    } catch {
      setPwError("Le changement de mot de passe a échoué, réessaie.");
    } finally {
      setPwSaving(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/connexion";
    }
  }

  return (
    <main className="profil-shell">
      <header className="page-header profil-header">
        <Link className="onboarding-brand" href="/">
          <span className="brand-mark">E</span> EvolyFoot
        </Link>
        <div>
          <span className="eyebrow light">Mon compte</span>
          <h1 title="Profil">Profil</h1>
          <p title="Tes informations d’éducateur et l’accès à ton compte.">
            Tes informations d’éducateur et l’accès à ton compte.
          </p>
        </div>
      </header>

      <section className="profil-content">
        {status === "loading" && <p className="profil-note">Chargement…</p>}
        {status === "unauthenticated" && (
          <p className="profil-note">
            <Link href="/connexion">Connecte-toi</Link> pour voir ton profil.
          </p>
        )}
        {status === "error" && <p className="profil-note">Impossible de charger le profil pour le moment.</p>}

        {status === "ready" && profile && (
          <>
            <div className="profil-banner">
              <div className="profil-identity">
                <span className="profil-avatar" aria-hidden="true">
                  {initials(profile.displayName)}
                </span>
                <div>
                  <h2>{profile.displayName}</h2>
                  <span className="profil-rating" aria-label="Note du profil : indicative">
                    ★★☆☆☆
                  </span>
                </div>
              </div>
              <div className="profil-plan">
                <span className="profil-plan-name">Plan gratuit</span>
                <span className="profil-plan-note">Toutes les fonctions essentielles</span>
                <button className="profil-plan-cta" disabled type="button">
                  Passer au premium (bientôt)
                </button>
              </div>
            </div>

            <div className="profil-block">
              <div className="profil-block-head">
                <h3>Informations personnelles</h3>
                {!editing && (
                  <button className="profil-edit" onClick={startEditing} type="button">
                    Modifier
                  </button>
                )}
              </div>

              {saved && !editing && <p className="profil-saved">Informations enregistrées.</p>}

              {editing && form ? (
                <form className="profil-form" onSubmit={saveProfile}>
                  {fields.map((field) => (
                    <label className="profil-field" key={field.key}>
                      <span>{field.label}</span>
                      {field.options ? (
                        <input
                          list={`profil-${field.key}-options`}
                          onChange={(event) => updateField(field.key, event.target.value)}
                          value={form[field.key]}
                        />
                      ) : (
                        <input
                          onChange={(event) => updateField(field.key, event.target.value)}
                          type={field.type}
                          value={form[field.key]}
                        />
                      )}
                      {field.options && (
                        <datalist id={`profil-${field.key}-options`}>
                          {field.options.map((option) => (
                            <option key={option} value={option} />
                          ))}
                        </datalist>
                      )}
                    </label>
                  ))}
                  <label className="profil-field">
                    <span>E-mail</span>
                    <input disabled value={profile.email} />
                  </label>
                  {saveError && (
                    <p className="profil-error" role="alert">
                      {saveError}
                    </p>
                  )}
                  <div className="profil-form-actions">
                    <button className="profil-primary" disabled={saving} type="submit">
                      Enregistrer
                    </button>
                    <button className="profil-ghost" onClick={cancelEditing} type="button">
                      Annuler
                    </button>
                  </div>
                </form>
              ) : (
                <dl className="profil-grid">
                  <div>
                    <dt>Nom</dt>
                    <dd>{profile.displayName}</dd>
                  </div>
                  <div>
                    <dt>Date de naissance</dt>
                    <dd>{formatBirthDate(profile.birthDate)}</dd>
                  </div>
                  <div>
                    <dt>Club</dt>
                    <dd>{profile.club ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Pays</dt>
                    <dd>{profile.country ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Adresse</dt>
                    <dd>{profile.address ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>E-mail</dt>
                    <dd>{profile.email}</dd>
                  </div>
                  <div>
                    <dt>Numéro de téléphone</dt>
                    <dd>{profile.phone ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Diplôme</dt>
                    <dd className={profile.diploma ? "" : "profil-todo"}>{profile.diploma ?? "À définir"}</dd>
                  </div>
                  <div>
                    <dt>Format de saison</dt>
                    <dd>{seasonLabel}</dd>
                  </div>
                </dl>
              )}
            </div>

            <div className="profil-block">
              <div className="profil-block-head">
                <h3>Accès au compte</h3>
              </div>
              {pwDone && <p className="profil-saved">Mot de passe mis à jour.</p>}
              {pwOpen ? (
                <form className="profil-password-form" onSubmit={changePassword}>
                  <label className="profil-field">
                    <span>Mot de passe actuel</span>
                    <input
                      autoComplete="current-password"
                      onChange={(event) => setPwCurrent(event.target.value)}
                      type="password"
                      value={pwCurrent}
                    />
                  </label>
                  <label className="profil-field">
                    <span>Nouveau mot de passe (10 caractères minimum)</span>
                    <input
                      autoComplete="new-password"
                      onChange={(event) => setPwNew(event.target.value)}
                      type="password"
                      value={pwNew}
                    />
                  </label>
                  <label className="profil-field">
                    <span>Confirmer le nouveau mot de passe</span>
                    <input
                      autoComplete="new-password"
                      onChange={(event) => setPwConfirm(event.target.value)}
                      type="password"
                      value={pwConfirm}
                    />
                  </label>
                  {pwError && (
                    <p className="profil-error" role="alert">
                      {pwError}
                    </p>
                  )}
                  <div className="profil-form-actions">
                    <button className="profil-primary" disabled={pwSaving} type="submit">
                      Mettre à jour le mot de passe
                    </button>
                    <button
                      className="profil-ghost"
                      onClick={() => {
                        setPwOpen(false);
                        setPwError("");
                      }}
                      type="button"
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              ) : (
                <div className="profil-account-actions">
                  <button className="profil-ghost" onClick={() => setPwOpen(true)} type="button">
                    Réinitialiser le mot de passe
                  </button>
                  <button className="profil-ghost profil-logout" onClick={logout} type="button">
                    Se déconnecter
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
