"use client";

import {
  createEmptyPlayerEvaluationScores,
  playerEvaluationAspectLabels,
  playerEvaluationAspects,
  playerEvaluationMaxScore,
  playerEvaluationMinScore,
  type PlayerEvaluationScores,
} from "@evolyfoot/domain";
import { useState } from "react";
import { RadarChart } from "../../charts";

interface DatedEvaluation {
  id: string;
  scores: PlayerEvaluationScores;
  createdAt: string;
}

interface SelfEvaluationProps {
  coachEvaluation: DatedEvaluation | undefined;
  initialSelfEvaluation: DatedEvaluation | undefined;
}

const radarAxes = playerEvaluationAspects.map((aspect) => ({ key: aspect, label: playerEvaluationAspectLabels[aspect] }));
const coachColor = "#3ec6f5";
const selfColor = "#ffb073";

// Le joueur se note sur les mêmes aspects que son éducateur ; les deux toiles se superposent pour
// voir d'un coup d'œil où les regards diffèrent.
export function SelfEvaluation({ coachEvaluation, initialSelfEvaluation }: SelfEvaluationProps) {
  const [selfEvaluation, setSelfEvaluation] = useState(initialSelfEvaluation);
  const [scores, setScores] = useState<PlayerEvaluationScores>(() => initialSelfEvaluation?.scores ?? createEmptyPlayerEvaluationScores());
  const [state, setState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function submit() {
    setState("pending");
    try {
      const response = await fetch("/api/joueur/auto-evaluation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scores }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErrorMessage(typeof body.error === "string" ? body.error : "L’enregistrement a échoué, réessaie.");
        setState("error");
        return;
      }
      setSelfEvaluation(body.evaluation);
      setState("success");
    } catch {
      setErrorMessage("L’enregistrement a échoué, réessaie.");
      setState("error");
    }
  }

  const series = [
    ...(coachEvaluation ? [{ key: "coach", label: "Mon éducateur", color: coachColor, scores: coachEvaluation.scores }] : []),
    ...(selfEvaluation ? [{ key: "self", label: "Moi", color: selfColor, scores: selfEvaluation.scores }] : []),
  ];

  return (
    <section className="player-space-block">
      <h2>Mon auto-évaluation</h2>
      <p className="player-space-caption">Note-toi sur chaque aspect, puis compare avec le regard de ton éducateur.</p>
      <div className="player-self-evaluation">
        {series.length > 0 && <RadarChart axes={radarAxes} max={playerEvaluationMaxScore} min={playerEvaluationMinScore} series={series} size={280} />}
        <div className="player-self-evaluation-form">
          {playerEvaluationAspects.map((aspect) => (
            <label key={aspect}>
              <span>
                {playerEvaluationAspectLabels[aspect]} <strong>{scores[aspect]}</strong>
              </span>
              <input
                max={playerEvaluationMaxScore}
                min={playerEvaluationMinScore}
                onChange={(event) => {
                  setScores({ ...scores, [aspect]: Number(event.target.value) });
                  setState("idle");
                }}
                type="range"
                value={scores[aspect]}
              />
            </label>
          ))}
          <button className="continue-button" disabled={state === "pending"} onClick={submit} type="button">
            Enregistrer mon auto-évaluation
          </button>
          <p aria-live="polite" role="status">
            {state === "success" && "Auto-évaluation enregistrée."}
            {state === "error" && errorMessage}
          </p>
        </div>
      </div>
    </section>
  );
}
