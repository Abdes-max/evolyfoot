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
import Link from "next/link";
import { useState } from "react";
import { TacticalDiagramView } from "../tactical-diagram";

interface SessionBuilderProps {
  authenticated: boolean;
  onChange: (session: TrainingSession) => void;
  session: TrainingSession;
}

const kindLabels = {
  welcome: "Accueil",
  activation: "Activation",
  main: "Situation principale",
  game: "Jeu",
} as const;

type SaveState = "idle" | "pending" | "success" | "error" | "auth-required";

// Composant contrôlé : `session` vient du parent (qui charge le profil réel au montage), pour ne
// jamais figer une copie locale figée sur la séance de démonstration initiale.
export function SessionBuilder({ authenticated, onChange, session }: SessionBuilderProps) {
  const [validationStatus, setValidationStatus] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const duration = getSessionDuration(session);
  const isValid = canValidateSession(session);

  function editSession(nextSession: TrainingSession) {
    onChange(nextSession);
    setValidationStatus("");
    setSaveState("idle");
  }

  async function validateSession() {
    if (!authenticated) {
      setSaveState("auth-required");
      return;
    }

    setSaveState("pending");
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: session.title,
          ageGroup: session.ageGroup,
          playerCount: session.playerCount,
          theme: session.theme,
          intention: session.intention,
          blocks: session.blocks.map((block) => ({
            id: block.id,
            activityId: block.activity.id,
            durationMinutes: block.durationMinutes,
          })),
        }),
      });
      if (!response.ok) {
        setSaveState("error");
        return;
      }
      setSaveState("success");
      setValidationStatus("Séance prête");
    } catch {
      setSaveState("error");
    }
  }

  return (
    <section className="session-builder" aria-labelledby="session-builder-title">
      <div className="session-builder-summary">
        <div>
          <span className="eyebrow">DÉROULÉ MODULABLE</span>
          <h2 id="session-builder-title">{session.title}</h2>
          <p>{session.theme} · <span>{`${session.playerCount} joueurs`}</span></p>
        </div>
        <strong aria-atomic="true" aria-label={`Durée totale : ${duration} minutes`} aria-live="polite">{duration} min</strong>
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
                  <span className="session-block-kind">{kindLabels[block.activity.kind]}</span>
                  <h3>{block.activity.title}</h3>
                </div>
                <strong>{block.durationMinutes} min</strong>
              </div>
              <div className="session-block-body">
                <div className="session-block-diagram">
                  <TacticalDiagramView diagram={block.activity.diagram} />
                  <Link href={`/bibliotheque/${block.activity.id}`}>Voir le détail →</Link>
                </div>
                <div className="session-block-text">
                  <p>{block.activity.objective}</p>
                  <dl className="session-block-details">
                    <div><dt>Organisation</dt><dd>{block.activity.organization}</dd></div>
                    <div><dt>Consigne</dt><dd>{block.activity.instruction}</dd></div>
                    <div><dt>À observer</dt><dd>{block.activity.observable}</dd></div>
                  </dl>
                </div>
              </div>
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
        <button className="continue-button" disabled={!isValid || saveState === "pending"} onClick={validateSession} type="button">Valider cette séance <span aria-hidden="true">→</span></button>
        <p aria-live="polite" className="session-validation-status" role="status">{validationStatus}</p>
        {saveState === "auth-required" && (
          <p className="field-error">Connecte-toi pour enregistrer cette séance. <Link href="/connexion">Se connecter →</Link></p>
        )}
        {saveState === "error" && <p className="field-error">La sauvegarde a échoué, réessaie.</p>}
        {validationStatus && <Link className="observation-session-link" href="/observation?type=training">Observer cette séance →</Link>}
        {validationStatus && <Link className="back-link" href="/">Retour au tableau de bord</Link>}
      </div>
    </section>
  );
}
