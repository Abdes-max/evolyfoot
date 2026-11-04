import {
  buildSituationDiagram,
  findProgramSession,
  findProgramSituation,
  programSessions,
  programSource,
  programSubThemes,
  situationKindLabels,
  situationMinutes,
} from "@evolyfoot/domain";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SidebarNav } from "../../../sidebar-nav";
import { TacticalDiagramView } from "../../../tactical-diagram";

interface ProgramSessionPageProps {
  params: Promise<{ number: string }>;
}

export function generateStaticParams() {
  return programSessions.map((session) => ({ number: String(session.number) }));
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

export default async function ProgramSessionPage({ params }: ProgramSessionPageProps) {
  const { number } = await params;
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
              Séance type {session.number} · {session.type === "theme" ? programSubThemes[session.subTheme].theme : "Saison"}
            </span>
            <h1>{title}</h1>
            <p>{session.type === "evaluation" ? "75 minutes · 16 joueurs" : `${situations.length} situations · environ ${minutes} minutes · 16 joueurs`}</p>
          </div>
        </header>

        <section className="seances-content">
          <p>
            <Link href="/saison">← Retour à ma saison</Link>
          </p>

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
            <ol className="program-session-situations">
              {situations.map((situation, index) => (
                <li className="program-situation" key={`${situation.id}-${index}`}>
                  <span className="program-situation-meta">
                    {index + 1}. {situationKindLabels[situation.kind]} · {situation.sequences.count} × {situation.sequences.minutes} min · {situation.fieldSize}
                  </span>
                  <h2>{situation.title}</h2>
                  <TacticalDiagramView caption={situation.organization} diagram={buildSituationDiagram(situation.layout)} />
                  <p>
                    <strong>But :</strong> {situation.instruction}
                  </p>
                  <ul>
                    {situation.rules.map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ul>
                  <p>
                    <strong>À observer :</strong> {situation.observable}
                  </p>
                  {situation.rotation && (
                    <p>
                      <strong>Rotations :</strong> {situation.rotation}
                    </p>
                  )}
                  {situation.variation && (
                    <p>
                      <strong>Variante :</strong> {situation.variation}
                    </p>
                  )}
                  <Link href={`/bibliotheque/${situation.id}`}>Voir l’animation et les points clés</Link>
                </li>
              ))}
            </ol>
          )}
          <p className="seances-hint">{programSource}.</p>
        </section>
      </main>
    </>
  );
}
