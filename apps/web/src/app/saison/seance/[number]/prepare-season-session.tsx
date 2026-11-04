"use client";

import { seasonSlotDate, type AgeGroup, type TrainingDay } from "@evolyfoot/domain";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PlaceInput } from "../../../place-input";

interface PrepareSeasonSessionProps {
  sessionNumber: number;
  week: number;
  slot: number;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

// Valeurs des champs date/heure en heure locale.
function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toTimeInput(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// « Préparer cette séance » : date, heure et lieu préremplis (jour d'entraînement de la semaine,
// lieu de la dernière séance), le coach n'a souvent qu'à valider.
export function PrepareSeasonSession({ sessionNumber, week, slot }: PrepareSeasonSessionProps) {
  const router = useRouter();
  const [team, setTeam] = useState<{ ageGroup: AgeGroup; playerCount: number } | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("18:00");
  const [location, setLocation] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");
  // Début de la préparation (ouverture de l'écran), pour l'indicateur « première séance en moins de 10 minutes ».
  const preparationStart = useRef<number | null>(null);
  useEffect(() => {
    preparationStart.current = Date.now();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [programBody, teamBody, sessionsBody] = await Promise.all(
        ["/api/season-program", "/api/team", "/api/sessions?scope=season"].map((url) =>
          fetch(url)
            .then((response) => (response.ok ? response.json() : null))
            .catch(() => null),
        ),
      );
      if (cancelled) return;
      const profile = teamBody?.profile;
      setTeam(profile ? { ageGroup: profile.ageGroup, playerCount: profile.playerCount } : null);
      const start = programBody?.program?.startDate ? new Date(`${programBody.program.startDate}T00:00:00`) : new Date();
      const proposed = seasonSlotDate(start, week, slot, (profile?.trainingDays ?? []) as TrainingDay[]);
      setDate(toDateInput(proposed));
      setTime(toTimeInput(proposed));
      const sessions: Array<{ location: string | null; createdAt: string }> = sessionsBody?.sessions ?? [];
      const last = [...sessions].filter((session) => session.location).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (last?.location) setLocation((current) => current || last.location!);
    })();
    return () => {
      cancelled = true;
    };
  }, [week, slot]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!team) {
      setState("error");
      setError("Crée d’abord ton équipe pour préparer une séance.");
      return;
    }
    if (!location.trim()) {
      setState("error");
      setError("Indique le lieu de la séance.");
      return;
    }
    setState("saving");
    const response = await fetch("/api/season-program/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionNumber,
        seasonWeek: week,
        slot,
        ageGroup: team.ageGroup,
        playerCount: team.playerCount,
        meetingAt: new Date(`${date}T${time}`).toISOString(),
        location,
        ...(preparationStart.current !== null ? { preparationSeconds: Math.round((Date.now() - preparationStart.current) / 1000) } : {}),
      }),
    }).catch(() => null);
    const body = await response?.json().catch(() => null);
    if (response?.ok && body?.session?.id) {
      router.push(`/session/${body.session.id}`);
      return;
    }
    setState("error");
    setError(body?.error ?? "La séance n’a pas pu être préparée.");
  }

  return (
    <form className="program-situation prepare-season-session" onSubmit={submit}>
      <h2>Préparer cette séance</h2>
      <p>Semaine {week} de ta saison. Elle rejoint ton calendrier, avec convocation et présences.</p>
      <div className="prepare-season-fields">
        <label>
          <span>Date</span>
          <input onChange={(event) => setDate(event.target.value)} required type="date" value={date} />
        </label>
        <label>
          <span>Heure</span>
          <input onChange={(event) => setTime(event.target.value)} required type="time" value={time} />
        </label>
      </div>
      <label>
        <span>Lieu</span>
        <PlaceInput onChange={setLocation} value={location} />
      </label>
      <button className="primary-button" disabled={state === "saving" || !date} type="submit">
        {state === "saving" ? "Préparation…" : "Préparer cette séance"}
      </button>
      {state === "error" && <p role="alert">{error}</p>}
    </form>
  );
}
