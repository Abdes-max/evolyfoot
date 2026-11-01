"use client";

import { analyzeMatchup, formationSlots, listFormations, type GameFormat, type LineBalance } from "@evolyfoot/domain";
import Link from "next/link";
import { useState } from "react";

const balanceLabels: Record<LineBalance, string> = { advantage: "Surnombre", even: "Égalité", disadvantage: "Infériorité" };
const pitchWidth = 300;
const pitchHeight = 460;

interface MatchAnalysisProps {
  matchId: string;
  gameFormat: GameFormat;
  formationId: string;
  opponentFormationId: string | null;
}

export function MatchAnalysis({ matchId, gameFormat, formationId, opponentFormationId }: MatchAnalysisProps) {
  const [opponent, setOpponent] = useState(opponentFormationId ?? "");
  const [saveError, setSaveError] = useState("");
  const formations = listFormations(gameFormat);
  const known = formations.some((formation) => formation.id === opponent);
  const analysis = known ? analyzeMatchup(gameFormat, formationId, opponent) : null;

  async function chooseOpponent(value: string) {
    setOpponent(value);
    setSaveError("");
    const response = await fetch(`/api/matches/${matchId}/details`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ opponentFormationId: value || null }),
    }).catch(() => null);
    if (!response?.ok) {
      setSaveError("Le système adverse n’a pas été enregistré.");
    }
  }

  return (
    <section aria-labelledby="match-analysis-title" className="match-analysis">
      <h2 id="match-analysis-title">Analyse de l’adversaire</h2>
      <label>
        <span>Système de l’adversaire</span>
        <select onChange={(event) => chooseOpponent(event.target.value)} value={known ? opponent : ""}>
          <option value="">Choisir</option>
          {formations.map((formation) => (
            <option key={formation.id} value={formation.id}>
              {formation.label}
            </option>
          ))}
        </select>
      </label>
      {saveError && (
        <p className="field-error" role="alert">
          {saveError}
        </p>
      )}

      {analysis && (
        <div className="match-analysis-body">
          <svg aria-label={`Ton ${formationId} face au ${opponent}`} role="img" viewBox={`0 0 ${pitchWidth} ${pitchHeight}`}>
            <rect className="match-pitch-turf" height={pitchHeight - 4} rx="10" width={pitchWidth - 4} x="2" y="2" />
            <line className="match-pitch-line" x1="2" x2={pitchWidth - 2} y1={pitchHeight / 2} y2={pitchHeight / 2} />
            {formationSlots(gameFormat, formationId).map((slot) => (
              <circle className="match-analysis-ours" cx={slot.x} cy={pitchHeight / 2 + slot.y / 2} key={slot.id} r="10" />
            ))}
            {formationSlots(gameFormat, opponent).map((slot) => (
              <circle className="match-analysis-theirs" cx={pitchWidth - slot.x} cy={pitchHeight / 2 - slot.y / 2} key={slot.id} r="10" />
            ))}
          </svg>

          <div>
            <p className="match-analysis-legend">
              <span className="ours">Ton équipe</span> <span className="theirs">Adversaire</span>
            </p>
            <p className="match-analysis-summary">{analysis.summary}</p>
            <ul className="match-analysis-lines">
              {analysis.lines.map((line) => (
                <li key={line.id}>
                  <div>
                    <strong>{line.label}</strong>
                    <span className={`match-analysis-balance ${line.balance}`}>
                      {line.ours} contre {line.theirs} · {balanceLabels[line.balance]}
                    </span>
                  </div>
                  <p>{line.advice}</p>
                </li>
              ))}
            </ul>
            <h3>À travailler avant le match : {analysis.theme}</h3>
            <ul className="match-analysis-exercises">
              {analysis.exercises.map((activity) => (
                <li key={activity.id}>
                  <Link href={`/bibliotheque/${activity.id}`}>{activity.title} →</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
