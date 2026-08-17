"use client";

import {
  adjustBlockDuration,
  canValidateSession,
  getSessionDuration,
  moveSessionBlock,
  replaceSessionActivity,
  type TrainingSession,
} from "@evolyfoot/domain";
import { useState } from "react";

interface SessionBuilderProps {
  initialSession: TrainingSession;
}

export function SessionBuilder({ initialSession }: SessionBuilderProps) {
  const [session, setSession] = useState(initialSession);
  const [validationStatus, setValidationStatus] = useState("");
  const duration = getSessionDuration(session);
  const isValid = canValidateSession(session);

  function editSession(nextSession: TrainingSession) {
    setSession(nextSession);
    setValidationStatus("");
  }

  return (
    <section className="session-builder" aria-labelledby="session-builder-title">
      <div className="session-builder-summary">
        <div>
          <span className="eyebrow">DÉROULÉ MODULABLE</span>
          <h2 id="session-builder-title">{session.title}</h2>
          <p>{session.theme}</p>
        </div>
        <strong aria-label={`Durée totale : ${duration} minutes`}>{duration} min</strong>
      </div>

      <ol className="session-block-list" aria-label="Les quatre temps de la séance">
        {session.blocks.map((block, index) => (
          <li className="session-block" key={`${block.activity.id}-${index}`}>
            <span className="session-block-number">{index + 1}</span>
            <article>
              <div className="session-block-heading">
                <div>
                  <span className="session-block-kind">{block.activity.kind}</span>
                  <h3>{block.activity.title}</h3>
                </div>
                <strong>{block.durationMinutes} min</strong>
              </div>
              <p>{block.activity.objective}</p>
              <div className="session-block-actions">
                <button aria-label="Retirer 5 minutes" onClick={() => editSession(adjustBlockDuration(session, index, -5))} type="button">− 5 min</button>
                <button aria-label="Ajouter 5 minutes" onClick={() => editSession(adjustBlockDuration(session, index, 5))} type="button">+ 5 min</button>
                <button aria-label="Monter" disabled={index === 0} onClick={() => editSession(moveSessionBlock(session, index, index - 1))} type="button">Monter</button>
                <button aria-label="Descendre" disabled={index === session.blocks.length - 1} onClick={() => editSession(moveSessionBlock(session, index, index + 1))} type="button">Descendre</button>
                <button aria-label="Remplacer la situation" onClick={() => editSession(replaceSessionActivity(session, index))} type="button">Remplacer</button>
              </div>
            </article>
          </li>
        ))}
      </ol>

      {!isValid && <p className="session-validation-error" role="alert">La séance doit durer entre 60 et 90 minutes.</p>}
      <div className="session-validation">
        <button className="continue-button" disabled={!isValid} onClick={() => setValidationStatus("Séance prête")} type="button">Valider cette séance <span>→</span></button>
        {validationStatus && <p className="session-validation-status" role="status">{validationStatus}</p>}
      </div>
    </section>
  );
}
