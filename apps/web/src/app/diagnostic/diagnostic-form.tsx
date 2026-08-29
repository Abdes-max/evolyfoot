"use client";

import { diagnosticCriteria, summarizeDiagnostic, type DiagnosticScores } from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useState } from "react";

const initialScores: DiagnosticScores = { availability: 2, scanning: 2, progression: 2, reactionAfterLoss: 2 };
const levels = ["Rarement", "Par moments", "Souvent", "Naturellement"];

type SaveState = "idle" | "pending" | "success" | "error" | "auth-required";

export function DiagnosticForm() {
  const [scores, setScores] = useState(initialScores);
  const [submitted, setSubmitted] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const summary = summarizeDiagnostic(scores);

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
          const diagnosticResponse = await fetch("/api/diagnostic");
          const diagnosticBody = await diagnosticResponse.json().catch(() => ({ scores: null }));
          if (!cancelled && diagnosticBody.scores) {
            setScores(diagnosticBody.scores);
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

  async function submit() {
    setSubmitted(true);
    if (!authenticated) {
      setSaveState("auth-required");
      return;
    }

    setSaveState("pending");
    try {
      const response = await fetch("/api/diagnostic", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(scores),
      });
      setSaveState(response.ok ? "success" : "error");
    } catch {
      setSaveState("error");
    }
  }

  return (
    <section className="diagnostic-panel">
      <div className="diagnostic-scale">
        <span>1 · Rarement</span>
        <span>4 · Naturellement</span>
      </div>
      {diagnosticCriteria.map((criterion) => (
        <article className="criterion-card" key={criterion.id}>
          <div>
            <h2>{criterion.label}</h2>
            <p>{criterion.description}</p>
          </div>
          <div aria-label={criterion.label} className="rating">
            {levels.map((level, index) => {
              const value = index + 1;
              return (
                <button
                  aria-label={`${criterion.label} : ${level}`}
                  aria-pressed={scores[criterion.id] === value}
                  className={scores[criterion.id] === value ? "active" : ""}
                  key={level}
                  onClick={() => {
                    setScores({ ...scores, [criterion.id]: value });
                    setSubmitted(false);
                    setSaveState("idle");
                  }}
                  type="button"
                >
                  <strong>{value}</strong>
                  <span>{level}</span>
                </button>
              );
            })}
          </div>
        </article>
      ))}
      <button className="continue-button" onClick={submit} type="button">
        Voir mes priorités <span>→</span>
      </button>
      {submitted && (
        <section className="diagnostic-result" role="status">
          <span className="eyebrow">SYNTHÈSE EVOLY</span>
          <h2>Deux priorités pour démarrer</h2>
          <div>
            {summary.priorities.map((priority) => (
              <article key={priority.criterion}>
                <strong>{priority.label}</strong>
                <span>
                  {priority.theme} · niveau {priority.score}/4
                </span>
              </article>
            ))}
          </div>
          <p>Ces priorités serviront à construire le premier cycle de quatre semaines.</p>
          {saveState === "auth-required" && (
            <p className="field-error">
              Connecte-toi pour sauvegarder ce diagnostic. <Link href="/connexion">Se connecter →</Link>
            </p>
          )}
          {saveState === "error" && <p className="field-error">La sauvegarde a échoué, réessaie.</p>}
          <Link href="/plan">Construire mon cycle →</Link>
        </section>
      )}
    </section>
  );
}
