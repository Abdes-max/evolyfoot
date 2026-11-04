"use client";

import {
  developmentThemes,
  parseExerciseText,
  type DevelopmentTheme,
  type PersonalExercise,
  type PersonalExerciseInput,
  type TrainingBlockKind,
} from "@evolyfoot/domain";
import { useEffect, useState, type FormEvent } from "react";
import { resizeImageToDataUrl } from "../image-resize";

const kindOptions: ReadonlyArray<{ value: TrainingBlockKind; label: string }> = [
  { value: "welcome", label: "Accueil" },
  { value: "activation", label: "Activation" },
  { value: "main", label: "Situation principale" },
  { value: "game", label: "Jeu" },
];
const themeOptions: readonly DevelopmentTheme[] = developmentThemes;
const emptyForm: PersonalExerciseInput = {
  kind: "main",
  theme: "Conserver le ballon",
  title: "",
  objective: "",
  organization: "",
  instruction: "",
  observable: "",
  photo: null,
};
// Assez grand pour relire un schéma papier, contrairement aux 320px des photos de joueurs.
const schemaPhotoMaxSide = 900;

export function PersonalExercises() {
  const [exercises, setExercises] = useState<PersonalExercise[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PersonalExerciseInput>(emptyForm);
  const [pastedText, setPastedText] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/personal-exercises")
      .then((response) => response.json())
      .then((body) => {
        if (!cancelled) {
          setExercises(body.exercises ?? []);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  function setField<Key extends keyof PersonalExerciseInput>(key: Key, value: PersonalExerciseInput[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function fillFromText() {
    setForm((current) => ({ ...current, ...parseExerciseText(pastedText) }));
  }

  async function choosePhoto(file: File | undefined) {
    if (!file) {
      return;
    }
    try {
      setField("photo", await resizeImageToDataUrl(file, schemaPhotoMaxSide));
      setError("");
    } catch {
      setError("Cette image n’a pas pu être lue.");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/personal-exercises", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof body.error === "string" ? body.error : "L’enregistrement a échoué, réessaie.");
        return;
      }
      setExercises((current) => [body.exercise, ...current]);
      setForm(emptyForm);
      setPastedText("");
      setOpen(false);
    } catch {
      setError("L’enregistrement a échoué, réessaie.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const response = await fetch(`/api/personal-exercises/${id}`, { method: "DELETE" }).catch(() => null);
    if (response?.ok) {
      setExercises((current) => current.filter((exercise) => exercise.id !== id));
    }
  }

  return (
    <section aria-labelledby="personal-exercises-title" className="personal-exercises">
      <div className="personal-exercises-head">
        <div>
          <h2 id="personal-exercises-title">Mes exercices</h2>
          <p>Ajoute tes situations ou celles de ta fédération, puis utilise-les dans tes séances.</p>
        </div>
        <button className="seances-create" onClick={() => setOpen((value) => !value)} type="button">
          {open ? "Fermer" : "Ajouter ou importer"}
        </button>
      </div>

      {open && (
        <form className="personal-exercise-form" onSubmit={submit}>
          <label>
            <span>Coller une fiche (facultatif)</span>
            <textarea
              onChange={(event) => setPastedText(event.target.value)}
              placeholder={"Titre de l’exercice\nObjectif : ...\nOrganisation : ...\nConsigne : ...\nÀ observer : ..."}
              rows={4}
              value={pastedText}
            />
          </label>
          <button disabled={!pastedText.trim()} onClick={fillFromText} type="button">
            Remplir la fiche depuis ce texte
          </button>
          <div className="personal-exercise-row">
            <label>
              <span>Temps de séance</span>
              <select onChange={(event) => setField("kind", event.target.value as TrainingBlockKind)} value={form.kind}>
                {kindOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Thème</span>
              <select onChange={(event) => setField("theme", event.target.value as DevelopmentTheme)} value={form.theme}>
                {themeOptions.map((theme) => (
                  <option key={theme}>{theme}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            <span>Titre</span>
            <input onChange={(event) => setField("title", event.target.value)} required value={form.title} />
          </label>
          {(
            [
              ["objective", "Objectif"],
              ["organization", "Organisation"],
              ["instruction", "Consigne"],
              ["observable", "À observer"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              <span>{label}</span>
              <textarea onChange={(event) => setField(key, event.target.value)} rows={2} value={form[key]} />
            </label>
          ))}
          <label>
            <span>Photo du schéma papier (facultatif)</span>
            <input accept="image/*" onChange={(event) => choosePhoto(event.target.files?.[0])} type="file" />
          </label>
          {form.photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="Aperçu du schéma" className="personal-exercise-photo" src={form.photo} />
          )}
          {error && <p className="field-error">{error}</p>}
          <button className="continue-button" disabled={saving} type="submit">
            Enregistrer l’exercice
          </button>
        </form>
      )}

      {exercises.length === 0 ? (
        <p className="bibliotheque-empty">Tu n’as pas encore d’exercice personnel.</p>
      ) : (
        <ul className="personal-exercise-list">
          {exercises.map((exercise) => (
            <li key={exercise.id}>
              {exercise.photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={`Schéma de ${exercise.title}`} className="personal-exercise-photo" src={exercise.photo} />
              )}
              <strong>{exercise.title}</strong>
              <span>
                {kindOptions.find((option) => option.value === exercise.kind)?.label} · {exercise.theme}
              </span>
              {exercise.organization && <p>{exercise.organization}</p>}
              <button aria-label={`Retirer ${exercise.title}`} onClick={() => remove(exercise.id)} type="button">
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
