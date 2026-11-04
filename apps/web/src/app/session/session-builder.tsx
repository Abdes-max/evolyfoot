"use client";

import {
  adjustBlockDuration,
  canReplaceSessionActivity,
  canValidateSession,
  diagramTargets,
  getSessionDuration,
  isPersonalActivityId,
  moveSessionBlock,
  personalExerciseToActivity,
  replaceBlockActivity,
  replaceSessionActivity,
  type AttendanceEntry,
  type PersonalExercise,
  type TrainingSession,
} from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { parseDatetimeInputValue, toDatetimeInputValue } from "../date-format";
import { ExerciseSheet } from "../exercise-sheet";
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
  // Séance préparée depuis la saison guidée : se ré-enregistre dans son cycle réservé.
  guidedSeason?: boolean;
  // Rendez-vous (date + heure), obligatoire -- ISO si la séance en a déjà un (mode "edit"), sinon
  // `null` (mode "create", à renseigner avant de pouvoir valider). Un seul input pour ce champ,
  // ici plutôt que dans le formulaire "Détails" de saved-session-view.tsx (qui ne garde que
  // lieu/description) : "Valider cette séance" ci-dessous appelle le même POST /api/sessions dans
  // les deux modes, toujours avec un rendez-vous -- deux formulaires distincts pour un même champ
  // auraient pu se marcher dessus (l'un écrasant silencieusement la valeur de l'autre).
  meetingAt: string | null;
  // Raison de chaque bloc, affichée pour une séance tout juste générée.
  blockReasons?: ReadonlyArray<{ blockId: string; reason: string }>;
  personalExercises?: readonly PersonalExercise[];
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
  guidedSeason = false,
  meetingAt,
  blockReasons = [],
  personalExercises = [],
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
  // Exercice ouvert, par identifiant de bloc : il reste le bon si l'ordre de la séance change.
  const [openBlockId, setOpenBlockId] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const exerciseRef = useRef<HTMLElement>(null);
  const openIndex = session.blocks.findIndex((block) => block.id === openBlockId);
  const openBlock = openIndex >= 0 ? session.blocks[openIndex] : undefined;
  const openReason = blockReasons.find((candidate) => candidate.blockId === openBlockId)?.reason;
  const duration = getSessionDuration(session);

  // La liste et la fiche n'ont pas la même hauteur : on repart du haut de l'exercice ouvert.
  useEffect(() => {
    if (openBlockId) {
      exerciseRef.current?.scrollIntoView?.({ block: "start" });
    }
  }, [openBlockId]);
  const meetingAtDate = parseDatetimeInputValue(meetingAtInput);
  const isValid = canValidateSession(session) && meetingAtDate !== null;

  function editSession(nextSession: TrainingSession) {
    onChange(nextSession);
    setValidationStatus("");
    setSaveState("idle");
  }

  // Le PDF contient toutes les fiches : on les rend le temps de l'impression, qui bloque la page.
  function exportPdf() {
    flushSync(() => setPrinting(true));
    window.print();
    setPrinting(false);
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
          ...(guidedSeason ? { guidedSeason: true } : {}),
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
          <p>
            {session.theme} · <span>{`${session.playerCount} joueurs`}</span>
          </p>
        </div>
        <strong aria-atomic="true" aria-label={`Durée totale : ${duration} minutes`} aria-live="polite">
          {duration} min
        </strong>
      </div>

      <button className="session-print" onClick={exportPdf} type="button">
        Exporter en PDF
      </button>

      {printing ? (
        session.blocks.map((block) => (
          <article className="session-print-sheet" key={block.id}>
            <span className="session-exercise-kind">{kindLabels[block.activity.kind]}</span>
            <h2 className="session-exercise-title">{block.activity.title}</h2>
            <ExerciseSheet activity={block.activity} durationMinutes={block.durationMinutes} playerCount={session.playerCount} />
          </article>
        ))
      ) : openBlock ? (
        <section aria-label={`Exercice ${openIndex! + 1} sur ${session.blocks.length}`} className="session-exercise" ref={exerciseRef}>
          <div className="session-exercise-bar">
            <button onClick={() => setOpenBlockId(null)} type="button">
              ← Toute la séance
            </button>
            <div className="session-exercise-pager">
              <button
                aria-label="Exercice précédent"
                disabled={openIndex === 0}
                onClick={() => setOpenBlockId(session.blocks[openIndex! - 1]!.id)}
                type="button"
              >
                ←
              </button>
              <span>
                Exercice {openIndex! + 1} sur {session.blocks.length}
              </span>
              <button
                aria-label="Exercice suivant"
                disabled={openIndex === session.blocks.length - 1}
                onClick={() => setOpenBlockId(session.blocks[openIndex! + 1]!.id)}
                type="button"
              >
                →
              </button>
            </div>
          </div>
          <span className="session-exercise-kind">
            {kindLabels[openBlock.activity.kind]} · {openBlock.durationMinutes} min
          </span>
          <h2 className="session-exercise-title">{openBlock.activity.title}</h2>
          {openReason && <p className="session-exercise-reason">{openReason}</p>}
          <ExerciseSheet activity={openBlock.activity} durationMinutes={openBlock.durationMinutes} playerCount={session.playerCount}>
            {!isPersonalActivityId(openBlock.activity.id) && (
              <Link className="session-exercise-library" href={`/bibliotheque/${openBlock.activity.id}`}>
                Voir dans la bibliothèque →
              </Link>
            )}
          </ExerciseSheet>
        </section>
      ) : (
        <ol className="session-run" aria-label="Les temps de la séance">
          {session.blocks.map((block, index) => {
            const canReplace = canReplaceSessionActivity(session, index);
            const replacementHintId = `${block.id}-replacement-hint`;
            return (
              <li className="session-run-item" key={block.id}>
                <div className="session-run-thumb">
                  {block.activity.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={`Schéma de ${block.activity.title}`} src={block.activity.photo} />
                  ) : (
                    <TacticalDiagramView diagram={block.activity.diagram} targets={diagramTargets(block.activity)} />
                  )}
                </div>
                <div className="session-run-body">
                  <span className="session-run-kind">
                    <strong>{kindLabels[block.activity.kind]}</strong> · {block.durationMinutes} min
                  </span>
                  <h3>
                    <button className="session-run-open" onClick={() => setOpenBlockId(block.id)} type="button">
                      {block.activity.title}
                    </button>
                  </h3>
                </div>
                <span aria-hidden="true" className="session-run-chevron">
                  ›
                </span>
                <div className="session-run-actions">
                  <button aria-label="Retirer 5 minutes" onClick={() => editSession(adjustBlockDuration(session, index, -5))} type="button">
                    − 5 min
                  </button>
                  <button aria-label="Ajouter 5 minutes" onClick={() => editSession(adjustBlockDuration(session, index, 5))} type="button">
                    + 5 min
                  </button>
                  <button aria-label="Monter" disabled={index === 0} onClick={() => editSession(moveSessionBlock(session, index, index - 1))} type="button">
                    ↑
                  </button>
                  <button
                    aria-label="Descendre"
                    disabled={index === session.blocks.length - 1}
                    onClick={() => editSession(moveSessionBlock(session, index, index + 1))}
                    type="button"
                  >
                    ↓
                  </button>
                  <button
                    aria-describedby={!canReplace ? replacementHintId : undefined}
                    aria-label="Remplacer la situation"
                    disabled={!canReplace}
                    onClick={() => editSession(replaceSessionActivity(session, index))}
                    type="button"
                  >
                    Remplacer
                  </button>
                  {personalExercises.some((exercise) => exercise.kind === block.activity.kind) && (
                    <select
                      aria-label="Utiliser un de mes exercices"
                      onChange={(event) => {
                        const exercise = personalExercises.find((candidate) => candidate.id === event.target.value);
                        if (exercise) {
                          editSession(replaceBlockActivity(session, index, personalExerciseToActivity(exercise)));
                        }
                      }}
                      value=""
                    >
                      <option value="">Mes exercices…</option>
                      {personalExercises
                        .filter((exercise) => exercise.kind === block.activity.kind)
                        .map((exercise) => (
                          <option key={exercise.id} value={exercise.id}>
                            {exercise.title}
                          </option>
                        ))}
                    </select>
                  )}
                  {!canReplace && (
                    <span className="visually-hidden" id={replacementHintId}>
                      Aucune autre situation compatible pour ce bloc.
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

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

      {!isValid && (
        <p className="session-validation-error" role="alert">
          La séance doit durer entre 60 et 90 minutes.
        </p>
      )}
      <div className="session-validation">
        <button className="continue-button" disabled={!isValid || saveState === "pending"} onClick={validateSession} type="button">
          Valider cette séance <span aria-hidden="true">→</span>
        </button>
        <p aria-live="polite" className="session-validation-status" role="status">
          {validationStatus}
        </p>
        {saveState === "auth-required" && (
          <p className="field-error">
            Connecte-toi pour enregistrer cette séance.{" "}
            <Link className="inline-cta" href="/connexion">
              Se connecter →
            </Link>
          </p>
        )}
        {saveState === "error" && <p className="field-error">La sauvegarde a échoué, réessaie.</p>}
        {validationStatus && (
          <Link className="observation-session-link" href="/observation?type=training">
            Observer cette séance →
          </Link>
        )}
        {validationStatus && (
          <Link className="back-link" href="/seances">
            Voir toutes mes séances
          </Link>
        )}
      </div>
    </section>
  );
}
