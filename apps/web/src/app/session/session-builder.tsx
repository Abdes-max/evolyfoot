"use client";

import {
  adjustBlockDuration,
  canReplaceSessionActivity,
  canValidateSession,
  getSessionDuration,
  moveSessionBlock,
  replaceSessionActivity,
  type AttendanceEntry,
  type TrainingSession,
} from "@evolyfoot/domain";
import Link from "next/link";
import { useState } from "react";
import { parseDatetimeInputValue, toDatetimeInputValue } from "../date-format";
import { TacticalDiagramView } from "../tactical-diagram";

interface RosterPlayer {
  id: string;
  name: string;
}

interface SessionBuilderProps {
  authenticated: boolean;
  onChange: (session: TrainingSession) => void;
  roster: readonly RosterPlayer[];
  session: TrainingSession;
  // Créneau du cycle où la séance est enregistrée (upsert sur (éducateur, semaine, slot)).
  weekNumber: number;
  slot: number;
  // Rendez-vous (date + heure), obligatoire -- ISO si la séance en a déjà un (mode "edit"), sinon
  // `null` (mode "create", à renseigner avant de pouvoir valider). Un seul input pour ce champ,
  // ici plutôt que dans le formulaire "Détails" de saved-session-view.tsx (qui ne garde que
  // lieu/description) : "Valider cette séance" ci-dessous appelle le même POST /api/sessions dans
  // les deux modes, toujours avec un rendez-vous -- deux formulaires distincts pour un même champ
  // auraient pu se marcher dessus (l'un écrasant silencieusement la valeur de l'autre).
  meetingAt: string | null;
  // "create" : nouvelle séance générée pour un créneau, on saisit la présence. "edit" : on ré-ouvre
  // une séance déjà enregistrée pour ajuster son déroulé -- la présence, saisie à la préparation,
  // n'est pas redemandée (et n'est pas réécrite) ici.
  mode?: "create" | "edit";
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
export function SessionBuilder({
  authenticated,
  onChange,
  roster,
  session,
  weekNumber,
  slot,
  meetingAt,
  mode = "create",
}: SessionBuilderProps) {
  const capturesAttendance = mode === "create" && roster.length > 0;
  const [validationStatus, setValidationStatus] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  // Initialisé une seule fois depuis la prop (valeur de départ, pas une resynchronisation
  // continue) : l'initialiseur paresseux de useState ne s'exécute qu'au montage, donc pas besoin
  // d'un useEffect ici -- voir le même principe ailleurs dans l'appli pour éviter la règle
  // react-hooks/set-state-in-effect.
  const [meetingAtInput, setMeetingAtInput] = useState(() => toDatetimeInputValue(meetingAt));
  // Ensemble des absents plutôt qu'une carte complète pré-remplie pour tout l'effectif : tout le
  // monde est présent par défaut (le cas le plus fréquent, l'éducateur décoche les absents plutôt
  // que de tout cocher) -- et ça évite de devoir recopier `roster` dans un état local via un
  // useEffect à chaque fois qu'il arrive du parent (voir sidebar-nav.tsx pour le même correctif).
  const [absentPlayerIds, setAbsentPlayerIds] = useState<ReadonlySet<string>>(new Set());
  const duration = getSessionDuration(session);
  const meetingAtDate = parseDatetimeInputValue(meetingAtInput);
  const isValid = canValidateSession(session) && meetingAtDate !== null;

  function editSession(nextSession: TrainingSession) {
    onChange(nextSession);
    setValidationStatus("");
    setSaveState("idle");
  }

  function toggleAttendance(playerId: string) {
    setAbsentPlayerIds((current) => {
      const next = new Set(current);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  }

  async function validateSession() {
    if (!authenticated) {
      setSaveState("auth-required");
      return;
    }
    if (!meetingAtDate) {
      return;
    }

    setSaveState("pending");
    try {
      const attendance: AttendanceEntry[] = capturesAttendance
        ? roster.map((player) => ({
            playerId: player.id,
            playerName: player.name,
            present: !absentPlayerIds.has(player.id),
          }))
        : [];
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
          meetingAt: meetingAtDate.toISOString(),
          weekNumber,
          slot,
          ...(attendance.length > 0 ? { attendance } : {}),
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
                  <Link className="inline-cta" href={`/bibliotheque/${block.activity.id}`}>Voir le détail →</Link>
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

      <label className="session-meeting-at">
        <span>Rendez-vous (date et heure)</span>
        <input onChange={(event) => setMeetingAtInput(event.target.value)} required type="datetime-local" value={meetingAtInput} />
      </label>

      {capturesAttendance && (
        <section aria-labelledby="session-attendance-title" className="session-attendance">
          <h2 id="session-attendance-title">Présence</h2>
          <p>Décoche les joueurs absents.</p>
          <ul className="session-attendance-list">
            {roster.map((player) => {
              const present = !absentPlayerIds.has(player.id);
              return (
                <li key={player.id}>
                  <label className={present ? "" : "absent"}>
                    <input checked={present} onChange={() => toggleAttendance(player.id)} type="checkbox" />
                    {player.name}
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!isValid && <p className="session-validation-error" role="alert">La séance doit durer entre 60 et 90 minutes.</p>}
      <div className="session-validation">
        <button className="continue-button" disabled={!isValid || saveState === "pending"} onClick={validateSession} type="button">Valider cette séance <span aria-hidden="true">→</span></button>
        <p aria-live="polite" className="session-validation-status" role="status">{validationStatus}</p>
        {saveState === "auth-required" && (
          <p className="field-error">Connecte-toi pour enregistrer cette séance. <Link className="inline-cta" href="/connexion">Se connecter →</Link></p>
        )}
        {saveState === "error" && <p className="field-error">La sauvegarde a échoué, réessaie.</p>}
        {validationStatus && <Link className="observation-session-link" href="/observation?type=training">Observer cette séance →</Link>}
        {validationStatus && <Link className="back-link" href="/seances">Voir toutes mes séances</Link>}
      </div>
    </section>
  );
}
