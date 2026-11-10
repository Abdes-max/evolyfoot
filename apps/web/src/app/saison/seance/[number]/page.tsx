import {
  findProgramSession,
  findProgramSituation,
  programBandLabels,
  programBandOfSession,
  programSessionLabelNumber,
  programSessions,
  programSessionsU12,
  programSource,
  programSubThemes,
  situationMinutes,
} from "@evolyfoot/domain";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SidebarNav } from "../../../sidebar-nav";
import { PrepareSeasonSession } from "./prepare-season-session";
import { SeasonSessionWorkshop } from "./season-session-workshop";

interface ProgramSessionPageProps {
  params: Promise<{ number: string }>;
  // Créneau de la saison d'où la séance est ouverte : permet de la préparer.
  searchParams?: Promise<{ semaine?: string; creneau?: string }>;
}

export function generateStaticParams() {
  return [...programSessions, ...programSessionsU12].map((session) => ({ number: String(session.number) }));
}

const evaluationFocus = {
  attack: {
    title: "Évaluation collective · attaque",
    count: ["Séquences de plus de 4 passes", "Déséquilibres provoqués", "Tirs", "Buts marqués"],
  },
  defense: {
    title: "Évaluation collective · défense",
    count: ["Ballons récupérés", "Déséquilibres concédés", "Tirs concédés", "Buts encaissés"],
  },
} as const;

export default async function ProgramSessionPage({ params, searchParams }: ProgramSessionPageProps) {
  const { number } = await params;
  const query = (await searchParams) ?? {};
  const week = Number(query.semaine);
  const slot = Number(query.creneau);
  const preparable = Number.isInteger(week) && week >= 1 && week <= 36 && Number.isInteger(slot) && slot >= 0 && slot <= 3;
  const session = findProgramSession(Number(number));
  if (!session) notFound();

  const title =
    session.type === "evaluation"
      ? evaluationFocus[session.focus].title
      : session.type === "recreational"
        ? "Séance récréative"
        : programSubThemes[session.subTheme].label;
  const situations = session.type === "evaluation" ? [] : session.situations.map((id) => findProgramSituation(id)!);
  const minutes = situations.reduce((sum, situation) => sum + situationMinutes(situation), 0);

  return (
    <>
      <SidebarNav />
      <main className="seances-shell">
        <header className="page-header seances-header">
          <div>
            <span className="eyebrow light">
              Séance type {programSessionLabelNumber(session.number)} · {programBandLabels[programBandOfSession(session.number)]} ·{" "}
              {session.type === "theme" ? programSubThemes[session.subTheme].theme : "Saison"}
            </span>
            <h1>{title}</h1>
            <p>{session.type === "evaluation" ? "75 minutes · 16 joueurs" : `${situations.length} situations · environ ${minutes} minutes · 16 joueurs`}</p>
          </div>
        </header>

        <section className="seances-content">
          <Link className="page-back-button" href="/saison">
            <span aria-hidden="true">←</span> Retour à ma saison
          </Link>
          {preparable && session.type === "evaluation" && <PrepareSeasonSession sessionNumber={session.number} slot={slot} week={week} />}

          {session.type === "evaluation" ? (
            <article className="program-situation">
              <h2>Déroulé</h2>
              <p>
                Échauffement de 20 minutes, puis trois matchs de 20 minutes à 8 contre 8, toujours dans les mêmes conditions pour comparer d’une évaluation à
                l’autre. Laisse jouer sans annoncer ce que tu observes.
              </p>
              <h2>À compter pendant chaque match</h2>
              <ul>
                {evaluationFocus[session.focus].count.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ) : (
            <SeasonSessionWorkshop preparable={preparable ? { week, slot } : null} sessionNumber={session.number} situationIds={session.situations} />
          )}
          <p className="seances-hint">{programSource}.</p>
        </section>
      </main>
    </>
  );
}
