"use client";

import { diagnosticCriteria, type DiagnosticScores } from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ConvocationSettings } from "../convocation-settings";

interface SeasonTabData {
  priorities: string[] | null;
  scores: DiagnosticScores | null;
  trainingDays: string[];
  sessionsPerWeek: number | null;
}

// Onglet « Ma saison » du profil : ce qui oriente le travail de l’éducateur — priorités de la
// saison guidée, dernier diagnostic et rythme d’entraînement. Lecture seule, avec un lien vers
// l’écran où chaque élément se modifie.
export function SeasonTab() {
  const [data, setData] = useState<SeasonTabData | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [program, diagnostic, team] = await Promise.all(
        ["/api/season-program", "/api/diagnostic", "/api/team"].map((url) =>
          fetch(url)
            .then((response) => (response.ok ? response.json() : null))
            .catch(() => null),
        ),
      );
      if (cancelled) return;
      setData({
        priorities: program?.program?.priorities ?? null,
        scores: diagnostic?.scores ?? null,
        trainingDays: team?.profile?.trainingDays ?? [],
        sessionsPerWeek: team?.profile?.sessionsPerWeek ?? null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return <p className="profil-note">Chargement…</p>;

  return (
    <div className="profil-season">
      <div className="profil-block">
        <div className="profil-block-head">
          <h3>Priorités de la saison</h3>
          <Link className="profil-edit" href="/saison">
            Modifier
          </Link>
        </div>
        {data.priorities?.length ? (
          <ul className="profil-chips">
            {data.priorities.map((priority) => (
              <li key={priority}>{priority}</li>
            ))}
          </ul>
        ) : (
          <p className="profil-note">Pas encore de saison guidée : choisis tes priorités depuis la page Saison.</p>
        )}
      </div>

      <div className="profil-block">
        <div className="profil-block-head">
          <h3>Diagnostic de l’équipe</h3>
          <Link className="profil-edit" href="/diagnostic">
            {data.scores ? "Refaire" : "Faire le diagnostic"}
          </Link>
        </div>
        {data.scores ? (
          <dl className="profil-diagnostic">
            {diagnosticCriteria.map((criterion) => {
              const score = data.scores?.[criterion.id];
              return typeof score === "number" ? (
                <div key={criterion.id}>
                  <dt>{criterion.label}</dt>
                  <dd>{score}/4</dd>
                </div>
              ) : null;
            })}
          </dl>
        ) : (
          <p className="profil-note">Aucun diagnostic pour l’instant.</p>
        )}
      </div>

      <div className="profil-block">
        <div className="profil-block-head">
          <h3>Planning d’entraînement</h3>
          <Link className="profil-edit" href="/onboarding">
            Modifier
          </Link>
        </div>
        {data.trainingDays.length ? (
          <ul className="profil-chips">
            {data.trainingDays.map((day) => (
              <li key={day}>{day}</li>
            ))}
          </ul>
        ) : (
          <p className="profil-note">Aucun jour d’entraînement renseigné.</p>
        )}
      </div>

      <div className="profil-block">
        <ConvocationSettings />
      </div>
    </div>
  );
}
