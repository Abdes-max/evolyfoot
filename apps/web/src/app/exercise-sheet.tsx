import type { TrainingActivity } from "@evolyfoot/domain";
import type { ReactNode } from "react";
import { TacticalDiagramView } from "./tactical-diagram";

interface ExerciseSheetProps {
  activity: TrainingActivity;
  // Renseignés dans une séance, absents dans la bibliothèque.
  durationMinutes?: number;
  playerCount?: number;
  children?: ReactNode;
}

export function ExerciseSheet({ activity, durationMinutes, playerCount, children }: ExerciseSheetProps) {
  const steps = [
    { label: "Organisation", text: activity.organization },
    { label: "Consigne", text: activity.instruction },
    { label: "À observer", text: activity.observable },
  ].filter((step) => step.text);
  const opposition = activity.defenderCount > 0 ? `${activity.defenderCount} défenseur${activity.defenderCount > 1 ? "s" : ""}` : "Sans opposition";
  const facts = [
    activity.fieldSize,
    playerCount ? `${playerCount} joueurs` : null,
    durationMinutes ? `${durationMinutes} min` : null,
    opposition,
    activity.hasGoalkeeper ? "Gardien" : null,
  ].filter(Boolean);

  return (
    <div className="sheet">
      <div className="sheet-stage">
        <ul className="sheet-facts">
          {facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
        {activity.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={`Schéma de ${activity.title}`} className="sheet-photo" src={activity.photo} />
        ) : (
          <TacticalDiagramView diagram={activity.diagram} live />
        )}
        {activity.equipment.length > 0 && (
          <p className="sheet-equipment">
            <span>Matériel</span> {activity.equipment.join(" · ")}
          </p>
        )}
        {children}
      </div>

      <div className="sheet-content">
        {activity.objective && (
          <section className="sheet-goal">
            <span className="eyebrow">But du jeu</span>
            <p>{activity.objective}</p>
          </section>
        )}

        {steps.length > 0 && (
          <section>
            <h3>Le déroulé</h3>
            <ol className="sheet-steps">
              {steps.map((step) => (
                <li key={step.label}>
                  <strong>{step.label}</strong>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        {activity.rules.length > 0 && (
          <section>
            <h3>Les règles</h3>
            <ol className="sheet-rules">
              {activity.rules.map((rule, index) => (
                <li key={rule}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>{rule}</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        {activity.coachingPoints.length > 0 && (
          <section>
            <h3>Points de coaching</h3>
            <ul className="sheet-coaching">
              {activity.coachingPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
