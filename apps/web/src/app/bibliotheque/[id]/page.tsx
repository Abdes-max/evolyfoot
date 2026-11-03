import { findTrainingActivity, trainingActivityCatalogue, type TrainingBlockKind } from "@evolyfoot/domain";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExerciseSheet } from "../../exercise-sheet";
import { ExerciseFeedback } from "./exercise-feedback";
import { SidebarNav } from "../../sidebar-nav";

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
    <>
      <SidebarNav />
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

        <div className="exercise-heading">
          <span className="session-exercise-kind">{kindLabels[activity.kind]}</span>
          <h1 className="session-exercise-title">{activity.title}</h1>
        </div>
        <ExerciseSheet activity={activity} />

        <ExerciseFeedback />

        <nav aria-label="Navigation entre exercices" className="exercise-pager">
          {previous ? <Link href={`/bibliotheque/${previous.id}`}>← {previous.title}</Link> : <span />}
          <span className="exercise-pager-count">
            {index + 1} / {trainingActivityCatalogue.length}
          </span>
          {next ? <Link href={`/bibliotheque/${next.id}`}>{next.title} →</Link> : <span />}
        </nav>
      </main>
    </>
  );
}
