"use client";

import { trainingActivityCatalogue, type TrainingActivity, type TrainingBlockKind } from "@evolyfoot/domain";
import Link from "next/link";
import { useMemo, useState } from "react";
import { TacticalDiagramView } from "../tactical-diagram";

const kindLabels: Record<TrainingBlockKind, string> = {
  welcome: "Accueil",
  activation: "Activation",
  main: "Situation principale",
  game: "Jeu",
};
const kindFilters: ReadonlyArray<{ value: TrainingBlockKind | "all"; label: string }> = [
  { value: "all", label: "Toutes" },
  { value: "welcome", label: "Accueil" },
  { value: "activation", label: "Activation" },
  { value: "main", label: "Situation principale" },
  { value: "game", label: "Jeu" },
];

function matchesQuery(activity: TrainingActivity, query: string) {
  const haystack = `${activity.title} ${activity.objective}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export function BibliothequeBrowser() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<TrainingBlockKind | "all">("all");

  const activities = useMemo(
    () =>
      trainingActivityCatalogue.filter(
        (activity) => (kind === "all" || activity.kind === kind) && matchesQuery(activity, query),
      ),
    [kind, query],
  );

  return (
    <section className="bibliotheque">
      <div className="bibliotheque-toolbar">
        <label className="bibliotheque-search">
          <span className="visually-hidden">Rechercher une situation</span>
          <svg fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="15">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une situation…" type="search" value={query} />
        </label>
        <div className="bibliotheque-filters" role="group" aria-label="Filtrer par type de bloc">
          {kindFilters.map((filter) => (
            <button
              aria-pressed={kind === filter.value}
              className={kind === filter.value ? "active" : ""}
              key={filter.value}
              onClick={() => setKind(filter.value)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {activities.length === 0 ? (
        <p className="bibliotheque-empty">Aucune situation ne correspond à ta recherche.</p>
      ) : (
        <div className="bibliotheque-grid">
          {activities.map((activity) => (
            <Link className="bibliotheque-card" href={`/bibliotheque/${activity.id}`} key={activity.id}>
              <div className="bibliotheque-thumb">
                <TacticalDiagramView diagram={activity.diagram} />
              </div>
              <div className="bibliotheque-card-body">
                <div className="bibliotheque-card-meta">
                  <span>{kindLabels[activity.kind]}</span>
                  <span>{activity.fieldSize}</span>
                </div>
                <h3>{activity.title}</h3>
                <p>{activity.objective}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
