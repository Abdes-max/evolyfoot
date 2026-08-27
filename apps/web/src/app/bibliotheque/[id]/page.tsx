import { findTrainingActivity, trainingActivityCatalogue, type TrainingBlockKind } from "@evolyfoot/domain";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TacticalDiagramView } from "../../tactical-diagram";
import { ExerciseFeedback } from "./exercise-feedback";

const kindLabels: Record<TrainingBlockKind, string> = {
  welcome: "Accueil",
  activation: "Activation",
  main: "Situation principale",
  game: "Jeu",
};

interface ExercisePageProps {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return trainingActivityCatalogue.map((activity) => ({ id: activity.id }));
}

export default async function ExercisePage({ params }: ExercisePageProps) {
  const { id } = await params;
  const activity = findTrainingActivity(id);
  if (!activity) notFound();

  const index = trainingActivityCatalogue.findIndex((candidate) => candidate.id === activity.id);
  const previous = trainingActivityCatalogue[index - 1];
  const next = trainingActivityCatalogue[index + 1];

  return (
    <main className="exercise-shell">
      <header className="exercise-topbar">
        <Link aria-label="Retour à la bibliothèque" className="exercise-back" href="/bibliotheque">
          <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="18">
            <path d="M19 12H5" />
            <path d="m11 18-6-6 6-6" />
          </svg>
        </Link>
        <span className="exercise-crumb">
          <Link href="/bibliotheque">Bibliothèque</Link> · <strong>{activity.title}</strong>
        </span>
      </header>

      <div className="exercise-layout">
        <div>
          <div className="exercise-diagram-card">
            <TacticalDiagramView caption={activity.title} diagram={activity.diagram} />
            <p className="exercise-diagram-note">
              {activity.fieldSize} · {activity.defenderCount > 0 ? `${activity.defenderCount} défenseur${activity.defenderCount > 1 ? "s" : ""}` : "Sans opposition"}
            </p>
          </div>
        </div>

        <div>
          <span className="eyebrow">{kindLabels[activity.kind]}</span>
          <h1>{activity.title}</h1>

          <div className="exercise-meta-row">
            <span className="exercise-chip">
              <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="14">
                <rect height="18" rx="2" width="18" x="3" y="3" />
                <path d="M3 15h6v6" />
              </svg>
              {activity.fieldSize}
            </span>
            <span className="exercise-chip">
              <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="14">
                <circle cx="9" cy="8" r="3.2" />
                <path d="M3 20v-1.2A4.5 4.5 0 0 1 7.5 14.3h3A4.5 4.5 0 0 1 15 18.8V20" />
              </svg>
              {activity.defenderCount > 0 ? `${activity.defenderCount} défenseur${activity.defenderCount > 1 ? "s" : ""}` : "Sans opposition"}
            </span>
            {activity.hasGoalkeeper && (
              <span className="exercise-chip">
                <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="14">
                  <rect height="14" rx="2" width="14" x="5" y="5" />
                </svg>
                Gardien
              </span>
            )}
            {activity.equipment.map((item) => (
              <span className="exercise-chip" key={item}>
                <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="14">
                  <path d="M12 3 20 20H4Z" />
                </svg>
                {item}
              </span>
            ))}
          </div>

          <div className="exercise-callout">
            <span className="eyebrow">But du jeu</span>
            <p>{activity.objective}</p>
          </div>

          <div className="exercise-block-title">Règles &amp; consignes</div>
          <ol className="exercise-rules">
            {activity.rules.map((rule, ruleIndex) => (
              <li key={rule}>
                <span className="exercise-rule-num">{String(ruleIndex + 1).padStart(2, "0")}</span>
                {rule}
              </li>
            ))}
          </ol>

          <div className="exercise-block-title">Points de coaching</div>
          <ul className="exercise-coaching">
            {activity.coachingPoints.map((point) => (
              <li key={point}>
                <span aria-hidden="true" className="exercise-coaching-arrow">→</span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ExerciseFeedback />

      <nav aria-label="Navigation entre exercices" className="exercise-pager">
        {previous ? (
          <Link href={`/bibliotheque/${previous.id}`}>← {previous.title}</Link>
        ) : (
          <span />
        )}
        <span className="exercise-pager-count">
          {index + 1} / {trainingActivityCatalogue.length}
        </span>
        {next ? (
          <Link href={`/bibliotheque/${next.id}`}>{next.title} →</Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
