"use client";

import {
  attendanceDefaultOptions,
  convocationLeadOptions,
  type AttendanceDefault,
  type PlayerSelection,
  type TrainingConvocationSettings,
} from "@evolyfoot/domain";
import { useEffect, useState } from "react";
import { ConcernedPlayersPicker, type ConcernedPlayer } from "./concerned-players-picker";

// Réglage des convocations aux entraînements : quand elles partent, la réponse par défaut et les
// joueurs des entraînements. Affiché en invitation tant que l'éducateur n'a pas choisi (`prompt`), sinon en réglage.
export function ConvocationSettings({ prompt = false, onSaved }: { prompt?: boolean; onSaved?: (settings: TrainingConvocationSettings) => void }) {
  const [settings, setSettings] = useState<TrainingConvocationSettings | null>(null);
  const [leadDays, setLeadDays] = useState<number | null>(2);
  const [attendanceDefault, setAttendanceDefault] = useState<AttendanceDefault>("ask");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [roster, setRoster] = useState<ConcernedPlayer[]>([]);
  const [playerIds, setPlayerIds] = useState<PlayerSelection>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/team/convocations")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (cancelled || !body?.settings) return;
        const loaded: TrainingConvocationSettings = body.settings;
        setSettings(loaded);
        setPlayerIds(loaded.playerIds ?? null);
        if (loaded.attendanceDefault) {
          setLeadDays(loaded.leadDays);
          setAttendanceDefault(loaded.attendanceDefault);
        }
      })
      .catch(() => undefined);
    fetch("/api/roster")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => !cancelled && setRoster(body?.players ?? []))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setState("saving");
    const response = await fetch("/api/team/convocations", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ leadDays, attendanceDefault, playerIds }),
    }).catch(() => null);
    const body = response?.ok ? await response.json().catch(() => null) : null;
    if (!body?.settings) {
      setState("error");
      return;
    }
    setSettings(body.settings);
    setState("saved");
    onSaved?.(body.settings);
  }

  if (!settings || (prompt && settings.attendanceDefault)) return null;

  return (
    <section aria-labelledby="convocation-settings-title" className={prompt ? "convocation-settings is-prompt" : "convocation-settings"}>
      <h3 id="convocation-settings-title">{prompt ? "Quand envoyer les convocations aux entraînements ?" : "Convocations aux entraînements"}</h3>
      {prompt && <p className="convocation-settings-hint">Avant l’envoi, les joueurs voient la séance programmée, sans pouvoir répondre.</p>}
      <div aria-label="Envoi de la convocation" className="convocation-settings-options" role="radiogroup">
        {convocationLeadOptions.map((option) => (
          <button
            aria-checked={leadDays === option.value}
            className={leadDays === option.value ? "is-selected" : undefined}
            key={String(option.value)}
            onClick={() => setLeadDays(option.value)}
            role="radio"
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      <div aria-label="Réponse par défaut" className="convocation-settings-defaults" role="radiogroup">
        {attendanceDefaultOptions.map((option) => (
          <button
            aria-checked={attendanceDefault === option.value}
            className={attendanceDefault === option.value ? "is-selected" : undefined}
            key={option.value}
            onClick={() => setAttendanceDefault(option.value)}
            role="radio"
            type="button"
          >
            <strong>{option.label}</strong>
            <span>{option.hint}</span>
          </button>
        ))}
      </div>
      <ConcernedPlayersPicker
        hint="Seuls ces joueurs voient les séances, reçoivent la convocation et peuvent répondre."
        onChange={setPlayerIds}
        roster={roster}
        title="Joueurs des entraînements"
        value={playerIds}
      />
      <div className="convocation-settings-actions">
        <button className="primary-button" disabled={state === "saving" || playerIds?.length === 0} onClick={save} type="button">
          {state === "saving" ? "Enregistrement…" : "Enregistrer"}
        </button>
        {state === "saved" && <span className="convocation-settings-status">Réglage enregistré.</span>}
        {state === "error" && (
          <span className="convocation-settings-status error" role="alert">
            Le réglage n’a pas été enregistré.
          </span>
        )}
      </div>
    </section>
  );
}
