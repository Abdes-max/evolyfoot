"use client";

import {
  buildPrioritizedSeason,
  developmentThemes,
  guidedSeasonCycle,
  maxSeasonPriorities,
  programPrinciples,
  programSource,
  programSubThemes,
  seasonWeekAt,
  suggestSeasonPriorities,
  summarizeDiagnostic,
  type DevelopmentTheme,
  type DiagnosticScores,
  type SeasonSlot,
} from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

interface PreparedSession {
  id: string;
  cycleNumber: number;
  weekNumber: number;
  slot: number;
  meetingAt: string | null;
  location: string | null;
}

function seanceHref(sessionNumber: number, week: number, slot: number): string {
  return `/saison/seance/${sessionNumber}?semaine=${week}&creneau=${slot}`;
}

function preparedLabel(session: PreparedSession): string {
  const when = session.meetingAt
    ? new Date(session.meetingAt).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "";
  return [when, session.location].filter(Boolean).join(" · ");
}

interface Program {
  priorities: DevelopmentTheme[];
  startDate: string;
}

export const themeSlugs: Record<DevelopmentTheme, string> = {
  "Conserver le ballon": "keep",
  "Progresser ensemble": "progress",
  "Finir les actions": "finish",
  "Récupérer rapidement": "recover",
  "Protéger son but": "protect",
};

export function slotLabel(slot: Pick<SeasonSlot, "type" | "subTheme">): string {
  if (slot.type === "evaluation") return "Évaluation";
  if (slot.type === "recreational") return "Séance récréative";
  return programSubThemes[slot.subTheme!].label;
}

export function slotClass(slot: Pick<SeasonSlot, "type" | "subTheme" | "major">): string {
  if (slot.type !== "theme") return `season-slot ${slot.type}`;
  return `season-slot ${themeSlugs[programSubThemes[slot.subTheme!].theme]}${slot.major ? " major" : ""}`;
}

function PriorityPicker({ initial, onSaved, onCancel }: { initial: DevelopmentTheme[]; onSaved: (program: Program) => void; onCancel?: () => void }) {
  const [selected, setSelected] = useState<DevelopmentTheme[]>(initial);
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");

  function toggle(theme: DevelopmentTheme) {
    setSelected((current) => (current.includes(theme) ? current.filter((item) => item !== theme) : [...current, theme].slice(-maxSeasonPriorities)));
  }

  async function save() {
    setState("saving");
    const response = await fetch("/api/season-program", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ priorities: selected }),
    }).catch(() => null);
    const body = await response?.json().catch(() => null);
    if (response?.ok && body?.program) {
      onSaved(body.program);
    } else {
      setState("error");
    }
  }

  return (
    <div className="guided-picker">
      <p>Choisis 1 ou 2 thèmes prioritaires : ils occuperont environ 60 % des séances, les autres restent travaillés.</p>
      <div className="guided-picker-themes" role="group" aria-label="Thèmes prioritaires">
        {developmentThemes.map((theme) => (
          <button
            aria-pressed={selected.includes(theme)}
            className={`guided-theme ${themeSlugs[theme]}${selected.includes(theme) ? " is-selected" : ""}`}
            key={theme}
            onClick={() => toggle(theme)}
            type="button"
          >
            {theme}
          </button>
        ))}
      </div>
      <div className="guided-picker-actions">
        <button className="primary-button" disabled={selected.length === 0 || state === "saving"} onClick={save} type="button">
          {initial.length > 0 && onCancel ? "Mettre à jour ma saison" : "Lancer ma saison"}
        </button>
        {onCancel && (
          <button className="text-button" onClick={onCancel} type="button">
            Annuler
          </button>
        )}
      </div>
      {state === "error" && <p role="alert">La saison n’a pas pu être enregistrée.</p>}
    </div>
  );
}

// Tant qu'aucune saison guidée n'est lancée, l'ancien plan par cycles (`fallback`) reste affiché.
export function GuidedSeason({ now, fallback }: { now: Date; fallback?: ReactNode }) {
  const [program, setProgram] = useState<Program | null | undefined>(undefined);
  const [sessionsPerWeek, setSessionsPerWeek] = useState(2);
  const [suggested, setSuggested] = useState<DevelopmentTheme[]>([]);
  const [editing, setEditing] = useState(false);
  const [prepared, setPrepared] = useState<PreparedSession[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [programBody, teamBody, diagnosticBody, sessionsBody] = await Promise.all(
        ["/api/season-program", "/api/team", "/api/diagnostic", "/api/sessions?scope=season"].map((url) =>
          fetch(url)
            .then((response) => (response.ok ? response.json() : null))
            .catch(() => null),
        ),
      );
      if (cancelled) return;
      setSessionsPerWeek(teamBody?.profile?.sessionsPerWeek ?? 2);
      const scores: DiagnosticScores | null = diagnosticBody?.scores ?? null;
      setSuggested(scores ? suggestSeasonPriorities(summarizeDiagnostic(scores)) : []);
      setPrepared(((sessionsBody?.sessions ?? []) as PreparedSession[]).filter((session) => session.cycleNumber === guidedSeasonCycle));
      setProgram(programBody?.program ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const weeks = useMemo(() => (program ? buildPrioritizedSeason({ priorities: program.priorities, sessionsPerWeek }) : []), [program, sessionsPerWeek]);
  const currentWeek = program ? seasonWeekAt(new Date(`${program.startDate}T00:00:00`), now) : 1;
  const thisWeek = weeks[currentWeek - 1];

  if (program === undefined) return null;

  return (
    <>
      <section aria-labelledby="guided-season-title" className="guided-season">
        <div className="guided-season-head">
          <h2 id="guided-season-title">Ta saison guidée</h2>
          {program && !editing && (
            <button className="text-button" onClick={() => setEditing(true)} type="button">
              Modifier mes priorités
            </button>
          )}
        </div>

        {!program || editing ? (
          <PriorityPicker
            initial={program?.priorities ?? suggested}
            onCancel={program ? () => setEditing(false) : undefined}
            onSaved={(saved) => {
              setProgram(saved);
              setEditing(false);
            }}
          />
        ) : (
          <>
            <p className="guided-priorities">
              Priorités : <strong>{program.priorities.join(" · ")}</strong>
            </p>

            {thisWeek && (
              <div className="guided-this-week">
                <span className="eyebrow">
                  Semaine {currentWeek} sur {weeks.length}
                </span>
                <ul>
                  {thisWeek.slots.map((slot, index) => {
                    const done = prepared.find((session) => session.weekNumber === currentWeek && session.slot === index);
                    return (
                      <li key={`${slot.sessionNumber}-${index}`}>
                        <Link className={slotClass(slot)} href={done ? `/session/${done.id}` : seanceHref(slot.sessionNumber, currentWeek, index)}>
                          <small>Séance {index + 1}</small>
                          <strong>{slotLabel(slot)}</strong>
                          <span>{done ? `Préparée · ${preparedLabel(done)}` : "Préparer la séance"}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <ol className="guided-grid" aria-label="Les 36 semaines de la saison">
              {weeks.map((week) => (
                <li className={week.week === currentWeek ? "current" : undefined} key={week.week}>
                  <span>S{week.week}</span>
                  {week.slots.map((slot, index) => (
                    <Link
                      aria-label={`Semaine ${week.week}, séance ${index + 1} : ${slotLabel(slot)}`}
                      className={slotClass(slot)}
                      href={seanceHref(slot.sessionNumber, week.week, index)}
                      key={`${slot.sessionNumber}-${index}`}
                      title={slotLabel(slot)}
                    />
                  ))}
                </li>
              ))}
            </ol>

            <ul className="guided-legend">
              {developmentThemes.map((theme) => (
                <li className={`season-slot ${themeSlugs[theme]}${program.priorities.includes(theme) ? " major" : ""}`} key={theme}>
                  {theme}
                  {program.priorities.includes(theme) ? " (prioritaire)" : ""}
                </li>
              ))}
              <li className="season-slot evaluation">Évaluation</li>
              <li className="season-slot recreational">Récréative</li>
            </ul>

            <details className="guided-principles">
              <summary>Les principes de la saison</summary>
              <ul>
                {programPrinciples.map((principle) => (
                  <li key={principle}>{principle}</li>
                ))}
              </ul>
              <p>{programSource}.</p>
            </details>
          </>
        )}
      </section>
      {!program && fallback}
    </>
  );
}
