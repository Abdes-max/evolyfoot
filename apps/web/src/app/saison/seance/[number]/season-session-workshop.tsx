"use client";

import {
  activityCategoryLabels,
  findProgramSituation,
  findTrainingActivity,
  isActivityForBand,
  programBandOfSession,
  situationKindLabels,
  situationMinutes,
  trainingActivityCatalogue,
  type TrainingActivity,
} from "@evolyfoot/domain";
import Link from "next/link";
import { useState } from "react";
import { ExerciseSheet } from "../../../exercise-sheet";
import { PrepareSeasonSession } from "./prepare-season-session";

const kindLabels: Record<TrainingActivity["kind"], string> = { welcome: "Accueil", activation: "Activation", main: "Situation principale", game: "Jeu" };

interface SeasonSessionWorkshopProps {
  sessionNumber: number;
  // Situations de la séance type, dans l'ordre.
  situationIds: readonly string[];
  // Créneau de la saison d'où la séance est ouverte : permet de la préparer.
  preparable: { week: number; slot: number } | null;
}

// Exercices proposés à la place de celui d'une situation : les autres de même type (échauffement, jeu, match…).
function alternativesTo(activity: TrainingActivity, sessionNumber: number): TrainingActivity[] {
  const band = programBandOfSession(sessionNumber);
  return trainingActivityCatalogue.filter(
    (candidate) => candidate.kind === activity.kind && candidate.id !== activity.id && isActivityForBand(candidate.id, band),
  );
}

// Situations d'une séance type de la saison, chacune avec son animation : le coach peut changer un ou plusieurs
// exercices avant de préparer la séance, qui reprend alors ses choix.
export function SeasonSessionWorkshop({ sessionNumber, situationIds, preparable }: SeasonSessionWorkshopProps) {
  const [chosen, setChosen] = useState<string[]>([...situationIds]);
  const changedCount = chosen.filter((id, index) => id !== situationIds[index]).length;

  function choose(index: number, id: string) {
    setChosen((current) => current.map((value, position) => (position === index ? id : value)));
  }

  return (
    <>
      {preparable && (
        <PrepareSeasonSession activityIds={changedCount > 0 ? chosen : undefined} sessionNumber={sessionNumber} slot={preparable.slot} week={preparable.week} />
      )}
      {changedCount > 0 && (
        <p className="seances-hint" role="status">
          {changedCount} exercice{changedCount > 1 ? "s" : ""} changé{changedCount > 1 ? "s" : ""} : la séance préparée reprendra ce choix.
        </p>
      )}
      <ol className="program-session-situations">
        {chosen.map((id, index) => {
          const activity = findTrainingActivity(id)!;
          const original = findProgramSituation(situationIds[index]!);
          const situation = id === situationIds[index] ? original : undefined;
          const alternatives = alternativesTo(activity, sessionNumber);
          return (
            <li className="program-situation" key={`${situationIds[index]}-${index}`}>
              <span className="program-situation-meta">
                {index + 1}.{" "}
                {situation
                  ? `${situationKindLabels[situation.kind]} · ${situation.sequences.count} × ${situation.sequences.minutes} min · ${situation.fieldSize}`
                  : `${kindLabels[activity.kind]} · ${activity.fieldSize}`}
                {original ? ` · ${situationMinutes(original)} min prévues` : ""}
              </span>
              <h2>{activity.title}</h2>
              {activity.category ? <span className="activity-category-tag">{activityCategoryLabels[activity.category]}</span> : null}
              <ExerciseSheet activity={activity}>
                <div className="program-situation-change">
                  <label>
                    <span>Changer cet exercice</span>
                    <select
                      aria-label={`Changer l’exercice ${index + 1}`}
                      onChange={(event) => event.target.value && choose(index, event.target.value)}
                      value=""
                    >
                      <option value="">Choisir un autre exercice…</option>
                      {alternatives.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.title}
                          {candidate.category ? ` (${activityCategoryLabels[candidate.category]})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  {id !== situationIds[index] && (
                    <button onClick={() => choose(index, situationIds[index]!)} type="button">
                      Remettre l’exercice du programme
                    </button>
                  )}
                </div>
              </ExerciseSheet>
              {situation?.rotation && (
                <p>
                  <strong>Rotations :</strong> {situation.rotation}
                </p>
              )}
              {situation?.variation && (
                <p>
                  <strong>Variante :</strong> {situation.variation}
                </p>
              )}
              <Link href={`/bibliotheque/${activity.id}`}>Voir la fiche complète</Link>
            </li>
          );
        })}
      </ol>
    </>
  );
}
