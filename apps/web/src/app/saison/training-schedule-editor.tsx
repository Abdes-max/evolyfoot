"use client";

import { defaultTrainingTime, sortTrainingDays, type TrainingDay, type TrainingSlotSchedule } from "@evolyfoot/domain";
import Link from "next/link";
import { useState } from "react";
import { PlaceInput } from "../place-input";

// Une ligne par jour d'entraînement de l'équipe : heure et lieu repris par toutes les séances de ce
// jour (ex. lundi 12:00 à Aix, mercredi 16:00 à Marseille).
export function TrainingScheduleFields({
  trainingDays,
  value,
  onChange,
}: {
  trainingDays: readonly TrainingDay[];
  value: readonly TrainingSlotSchedule[];
  onChange: (value: TrainingSlotSchedule[]) => void;
}) {
  const days = sortTrainingDays(trainingDays);
  if (days.length === 0) {
    return (
      <p className="training-schedule-hint">
        Renseigne d’abord les jours d’entraînement dans <Link href="/onboarding">Modifier l’équipe</Link>.
      </p>
    );
  }
  const entryFor = (day: TrainingDay) => value.find((entry) => entry.day === day) ?? { day, time: defaultTrainingTime, location: "" };
  const update = (day: TrainingDay, patch: Partial<TrainingSlotSchedule>) =>
    onChange(days.map((candidate) => (candidate === day ? { ...entryFor(candidate), ...patch } : entryFor(candidate))));

  return (
    <div className="training-schedule">
      {days.map((day) => {
        const entry = entryFor(day);
        return (
          <div className="training-schedule-row" key={day}>
            <strong>{day}</strong>
            <label>
              <span>Heure</span>
              <input onChange={(event) => update(day, { time: event.target.value })} required type="time" value={entry.time} />
            </label>
            <label className="training-schedule-place">
              <span>Lieu</span>
              <PlaceInput onChange={(location) => update(day, { location })} value={entry.location} />
            </label>
          </div>
        );
      })}
    </div>
  );
}

// Bloc « Mes créneaux » de la saison : le seul endroit où l'heure et le lieu des séances se règlent ;
// les séances à venir déjà préparées suivent le nouveau réglage.
export function TrainingScheduleBlock({
  trainingDays,
  schedule,
  onSaved,
}: {
  trainingDays: readonly TrainingDay[];
  schedule: readonly TrainingSlotSchedule[];
  onSaved: (schedule: TrainingSlotSchedule[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TrainingSlotSchedule[]>([...schedule]);
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");

  async function save() {
    setState("saving");
    const response = await fetch("/api/season-program/schedule", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ schedule: draft }),
    }).catch(() => null);
    const body = await response?.json().catch(() => null);
    if (response?.ok && body?.program) {
      onSaved(body.program.schedule ?? []);
      setEditing(false);
      setState("idle");
      return;
    }
    setState("error");
    setError(body?.error ?? "Les créneaux n’ont pas été enregistrés.");
  }

  return (
    <section aria-labelledby="training-schedule-title" className="training-schedule-block" id="creneaux">
      <div className="guided-season-head">
        <h3 id="training-schedule-title">Mes créneaux</h3>
        {!editing && (
          <button
            className="text-button"
            onClick={() => {
              setDraft([...schedule]);
              setEditing(true);
            }}
            type="button"
          >
            Modifier
          </button>
        )}
      </div>
      {editing ? (
        <>
          <TrainingScheduleFields onChange={setDraft} trainingDays={trainingDays} value={draft} />
          <p className="training-schedule-hint">Les séances déjà préparées et à venir prendront ces horaires et ces lieux.</p>
          <div className="guided-picker-actions">
            <button className="primary-button" disabled={state === "saving"} onClick={save} type="button">
              {state === "saving" ? "Enregistrement…" : "Enregistrer mes créneaux"}
            </button>
            <button className="text-button" onClick={() => setEditing(false)} type="button">
              Annuler
            </button>
          </div>
          {state === "error" && <p role="alert">{error}</p>}
        </>
      ) : schedule.length === 0 ? (
        <p className="training-schedule-hint">Aucun créneau défini : indique l’heure et le lieu de chaque jour d’entraînement.</p>
      ) : (
        <ul className="training-schedule-summary">
          {sortTrainingDays(schedule.map((entry) => entry.day)).map((day) => {
            const entry = schedule.find((candidate) => candidate.day === day)!;
            return (
              <li key={day}>
                <strong>{day}</strong> · {entry.time}
                {entry.location ? ` · ${entry.location}` : ""}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
