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

// Analyse facultative : toujours repliée à l’ouverture de la fiche, même avec un système adverse
// enregistré. Le système adverse se choisit en un geste, puis le terrain et les lignes
// montrent où l’équipe est en surnombre ou en infériorité.
export function MatchAnalysis({ matchId, gameFormat, formationId, opponentFormationId }: MatchAnalysisProps) {
  const [opponent, setOpponent] = useState(opponentFormationId ?? "");
  const [open, setOpen] = useState(false);
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
      <div className="match-analysis-head">
        <div>
          <h2 id="match-analysis-title">Analyse de l’adversaire</h2>
          <p className="match-analysis-intro">Facultatif : compare ton système à celui de l’adversaire, ligne par ligne.</p>
        </div>
        <button
          aria-controls="match-analysis-content"
          aria-expanded={open}
          className="match-analysis-toggle"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          {open ? "Masquer" : "Analyser"}
        </button>
      </div>

      {open && (
        <div id="match-analysis-content">
          <div aria-label="Système de l’adversaire" className="match-analysis-systems" role="group">
            <span>Système de l’adversaire</span>
            {formations.map((formation) => (
              <button
                aria-pressed={formation.id === opponent}
                className="match-analysis-system"
                key={formation.id}
                onClick={() => chooseOpponent(formation.id === opponent ? "" : formation.id)}
                type="button"
              >
                {formation.label}
              </button>
            ))}
          </div>
          {saveError && (
            <p className="field-error" role="alert">
              {saveError}
            </p>
          )}

          {analysis && (
            <div className="match-analysis-body">
              <svg aria-label={`Ton ${formationId} face au ${opponent}`} role="img" viewBox={`0 0 ${pitchWidth} ${pitchHeight}`}>
                <rect className="match-pitch-turf" height={pitchHeight - 4} rx="12" width={pitchWidth - 4} x="2" y="2" />
                <line className="match-pitch-line" x1="2" x2={pitchWidth - 2} y1={pitchHeight / 2} y2={pitchHeight / 2} />
                <circle className="match-pitch-line" cx={pitchWidth / 2} cy={pitchHeight / 2} fill="none" r="38" />
                <rect className="match-pitch-line" fill="none" height="56" width="140" x="80" y="2" />
                <rect className="match-pitch-line" fill="none" height="56" width="140" x="80" y={pitchHeight - 58} />
                {formationSlots(gameFormat, formationId).map((slot) => (
                  <circle className="match-analysis-ours" cx={slot.x} cy={pitchHeight / 2 + slot.y / 2} key={slot.id} r="13" />
                ))}
                {formationSlots(gameFormat, opponent).map((slot) => (
                  <circle className="match-analysis-theirs" cx={pitchWidth - slot.x} cy={pitchHeight / 2 - slot.y / 2} key={slot.id} r="13" />
                ))}
              </svg>
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
          )}
        </div>
      )}
    </section>
  );
}
