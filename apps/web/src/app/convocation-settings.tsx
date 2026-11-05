"use client";

import { attendanceDefaultOptions, convocationLeadOptions, type AttendanceDefault, type TrainingConvocationSettings } from "@evolyfoot/domain";
import { useEffect, useState } from "react";

// Réglage des convocations aux entraînements : quand elles partent et la réponse par défaut des
// joueurs. Affiché en invitation tant que l'éducateur n'a pas choisi (`prompt`), sinon en réglage.
export function ConvocationSettings({ prompt = false, onSaved }: { prompt?: boolean; onSaved?: (settings: TrainingConvocationSettings) => void }) {
  const [settings, setSettings] = useState<TrainingConvocationSettings | null>(null);
  const [leadDays, setLeadDays] = useState<number | null>(2);
  const [attendanceDefault, setAttendanceDefault] = useState<AttendanceDefault>("ask");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/team/convocations")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (cancelled || !body?.settings) return;
        const loaded: TrainingConvocationSettings = body.settings;
        setSettings(loaded);
        if (loaded.attendanceDefault) {
          setLeadDays(loaded.leadDays);
          setAttendanceDefault(loaded.attendanceDefault);
        }
      })
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
      body: JSON.stringify({ leadDays, attendanceDefault }),
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
      <div className="convocation-settings-actions">
        <button className="primary-button" disabled={state === "saving"} onClick={save} type="button">
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
