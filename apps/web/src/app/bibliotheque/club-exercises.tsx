"use client";

import type { PersonalExerciseInput } from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useState } from "react";
import { loadClub, type ClubInfo, type SharedExercise } from "../club-api";

// Exercices des autres éducateurs du club. Les copier les ajoute à « Mes exercices », où chacun
// garde sa propre version.
export function ClubExercises() {
  // `undefined` tant que le club n'est pas chargé (ou pour un adjoint), `null` hors club.
  const [club, setClub] = useState<ClubInfo | null | undefined>(undefined);
  const [exercises, setExercises] = useState<SharedExercise[]>([]);
  const [copied, setCopied] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await loadClub();
      const shared = loaded
        ? await fetch("/api/club/exercises")
            .then((exercisesResponse) => exercisesResponse.json())
            .catch(() => null)
        : null;
      if (!cancelled) {
        setClub(loaded);
        setExercises(shared?.exercises ?? []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function copy(exercise: SharedExercise) {
    setError("");
    const input: PersonalExerciseInput = {
      kind: exercise.kind,
      theme: exercise.theme,
      title: exercise.title,
      objective: exercise.objective,
      organization: exercise.organization,
      instruction: exercise.instruction,
      observable: exercise.observable,
      photo: exercise.photo,
    };
    const response = await fetch("/api/personal-exercises", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }).catch(() => null);
    if (response?.ok) {
      setCopied((current) => [...current, exercise.id]);
      return;
    }
    const body = await response?.json().catch(() => null);
    setError(typeof body?.error === "string" ? body.error : "L’exercice n’a pas pu être copié.");
  }

  if (club === undefined) {
    return null;
  }

  return (
    <section aria-labelledby="club-exercises-title" className="personal-exercises">
      <div className="personal-exercises-head">
        <div>
          <h2 id="club-exercises-title">{club ? `Exercices du club · ${club.name}` : "Exercices du club"}</h2>
          <p>
            {club ? (
              "Les exercices des autres éducateurs du club. Copie ceux qui t’intéressent dans ta bibliothèque."
            ) : (
              <>
                Crée ou rejoins le club de tes collègues depuis ton <Link href="/profil">profil</Link> pour partager vos exercices.
              </>
            )}
          </p>
        </div>
      </div>
      {club && exercises.length === 0 && <p className="bibliotheque-empty">Les autres membres n’ont pas encore d’exercice personnel.</p>}
      {exercises.length > 0 && (
        <ul className="personal-exercise-list">
          {exercises.map((exercise) => (
            <li key={exercise.id}>
              {exercise.photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={`Schéma de ${exercise.title}`} className="personal-exercise-photo" src={exercise.photo} />
              )}
              <strong>{exercise.title}</strong>
              <span>
                {exercise.authorName} · {exercise.theme}
              </span>
              {exercise.organization && <p>{exercise.organization}</p>}
              <button aria-label={`Copier ${exercise.title}`} disabled={copied.includes(exercise.id)} onClick={() => copy(exercise)} type="button">
                {copied.includes(exercise.id) ? "Ajouté à mes exercices" : "Copier dans ma bibliothèque"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
