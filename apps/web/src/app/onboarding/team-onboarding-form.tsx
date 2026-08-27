"use client";

import { ageGroups, validateTeamProfile, type TeamProfile, type TrainingDay } from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

const days: TrainingDay[] = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const initialProfile: TeamProfile = { name: "", ageGroup: "U12", playerCount: 14, sessionsPerWeek: 2, trainingDays: [] };

type SaveState = "idle" | "pending" | "success" | "error" | "auth-required";

export function TeamOnboardingForm() {
  const [profile, setProfile] = useState(initialProfile);
  const [submitted, setSubmitted] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const sessionResponse = await fetch("/api/auth/session");
        const sessionBody = await sessionResponse.json().catch(() => ({ educator: null }));
        if (cancelled) {
          return;
        }
        const isAuthenticated = Boolean(sessionBody.educator);
        setAuthenticated(isAuthenticated);

        if (isAuthenticated) {
          const teamResponse = await fetch("/api/team");
          const teamBody = await teamResponse.json().catch(() => ({ profile: null }));
          if (!cancelled && teamBody.profile) {
            setProfile(teamBody.profile);
          }
        }
      } catch {
        if (!cancelled) {
          setAuthenticated(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const errors = submitted ? validateTeamProfile(profile) : {};
  const toggleDay = (day: TrainingDay) =>
    setProfile((current) => ({
      ...current,
      trainingDays: current.trainingDays.includes(day)
        ? current.trainingDays.filter((item) => item !== day)
        : [...current.trainingDays, day],
    }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(validateTeamProfile(profile)).length) {
      return;
    }
    if (!authenticated) {
      setSaveState("auth-required");
      return;
    }

    setSaveState("pending");
    try {
      const response = await fetch("/api/team", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setSaveError(typeof body.error === "string" ? body.error : "Une erreur est survenue.");
        setSaveState(response.status === 401 ? "auth-required" : "error");
        return;
      }
      setSaveState("success");
    } catch {
      setSaveError("Une erreur est survenue.");
      setSaveState("error");
    }
  }

  return (
    <form className="team-form" noValidate onSubmit={submit}>
      <header>
        <span className="eyebrow">PROFIL DE L’ÉQUIPE</span>
        <h2>Ta saison en quelques repères</h2>
        <p>Tu pourras modifier ces informations à tout moment.</p>
      </header>

      <label>
        Nom de l’équipe
        <input
          onChange={(event) => setProfile({ ...profile, name: event.target.value })}
          placeholder="Ex. FC Horizon"
          value={profile.name}
        />
        {errors.name && <small className="field-error">{errors.name}</small>}
      </label>

      <fieldset>
        <legend>Catégorie</legend>
        <div className="choice-grid">
          {ageGroups.map((group) => (
            <button
              aria-pressed={profile.ageGroup === group}
              className={profile.ageGroup === group ? "choice active" : "choice"}
              key={group}
              onClick={() => setProfile({ ...profile, ageGroup: group })}
              type="button"
            >
              {group}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="form-row">
        <label>
          Nombre de joueurs
          <input
            max="30"
            min="6"
            onChange={(event) => setProfile({ ...profile, playerCount: Number(event.target.value) })}
            type="number"
            value={profile.playerCount}
          />
          {errors.playerCount && <small className="field-error">{errors.playerCount}</small>}
        </label>
        <label>
          Séances par semaine
          <select
            onChange={(event) => setProfile({ ...profile, sessionsPerWeek: Number(event.target.value) })}
            value={profile.sessionsPerWeek}
          >
            {[1, 2, 3, 4].map((value) => (
              <option key={value} value={value}>
                {value} séance{value > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset>
        <legend>Jours d’entraînement</legend>
        <p className="field-hint">
          Sélectionne {profile.sessionsPerWeek} jour{profile.sessionsPerWeek > 1 ? "s" : ""}.
        </p>
        <div className="day-grid">
          {days.map((day) => (
            <button
              aria-pressed={profile.trainingDays.includes(day)}
              className={profile.trainingDays.includes(day) ? "day active" : "day"}
              key={day}
              onClick={() => toggleDay(day)}
              type="button"
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>
        {errors.trainingDays && <small className="field-error">{errors.trainingDays}</small>}
      </fieldset>

      {saveState === "success" && (
        <div className="success-message" role="status">
          <strong>Équipe prête !</strong>
          <span>La prochaine étape sera le diagnostic initial.</span>
          <Link href="/diagnostic">Commencer le diagnostic →</Link>
        </div>
      )}
      {saveState === "auth-required" && (
        <p className="field-error" role="alert">
          Connecte-toi pour enregistrer ton équipe. <Link href="/connexion">Se connecter →</Link>
        </p>
      )}
      {saveState === "error" && (
        <p className="field-error" role="alert">
          {saveError}
        </p>
      )}

      <button className="continue-button" disabled={saveState === "pending"} type="submit">
        {saveState === "pending" ? "Enregistrement…" : "Valider mon équipe"} <span>→</span>
      </button>
      <Link className="back-link" href="/">
        Retour au tableau de bord
      </Link>
    </form>
  );
}
