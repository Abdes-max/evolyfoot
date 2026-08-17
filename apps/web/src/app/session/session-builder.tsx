"use client";

import {
  adjustBlockDuration,
  canReplaceSessionActivity,
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
          <p>{session.theme} · <span>{`${session.playerCount} joueurs`}</span></p>
        </div>
        <strong aria-label={`Durée totale : ${duration} minutes`}>{duration} min</strong>
      </div>

      <ol className="session-block-list" aria-label="Les quatre temps de la séance">
        {session.blocks.map((block, index) => {
          const canReplace = canReplaceSessionActivity(session, index);
          const replacementHintId = `${block.id}-replacement-hint`;
          return (
          <li className="session-block" key={block.id}>
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
              <dl className="session-block-details">
                <div><dt>Organisation</dt><dd>{block.activity.organization}</dd></div>
                <div><dt>Consigne</dt><dd>{block.activity.instruction}</dd></div>
                <div><dt>À observer</dt><dd>{block.activity.observable}</dd></div>
              </dl>
              <div className="session-block-actions">
                <button aria-label="Retirer 5 minutes" onClick={() => editSession(adjustBlockDuration(session, index, -5))} type="button">− 5 min</button>
                <button aria-label="Ajouter 5 minutes" onClick={() => editSession(adjustBlockDuration(session, index, 5))} type="button">+ 5 min</button>
                <button aria-label="Monter" disabled={index === 0} onClick={() => editSession(moveSessionBlock(session, index, index - 1))} type="button">Monter</button>
                <button aria-label="Descendre" disabled={index === session.blocks.length - 1} onClick={() => editSession(moveSessionBlock(session, index, index + 1))} type="button">Descendre</button>
                <button aria-describedby={!canReplace ? replacementHintId : undefined} aria-label="Remplacer la situation" disabled={!canReplace} onClick={() => editSession(replaceSessionActivity(session, index))} type="button">Remplacer</button>
                {!canReplace && <span className="visually-hidden" id={replacementHintId}>Aucune autre situation compatible pour ce bloc.</span>}
              </div>
            </article>
          </li>
        );})}
      </ol>

      {!isValid && <p className="session-validation-error" role="alert">La séance doit durer entre 60 et 90 minutes.</p>}
      <div className="session-validation">
        <button className="continue-button" disabled={!isValid} onClick={() => setValidationStatus("Séance prête")} type="button">Valider cette séance <span aria-hidden="true">→</span></button>
        <p aria-live="polite" className="session-validation-status" role="status">{validationStatus}</p>
      </div>
    </section>
  );
}
