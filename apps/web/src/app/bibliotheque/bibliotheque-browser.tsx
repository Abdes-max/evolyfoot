"use client";

import {
  activityCategoryLabels,
  developmentThemes,
  type DevelopmentTheme,
  diagramTargets,
  type TrainingActivity,
  trainingActivityCatalogue,
  type TrainingBlockKind,
} from "@evolyfoot/domain";
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

const themeFilters: ReadonlyArray<DevelopmentTheme | "all"> = ["all", ...developmentThemes];

// Filtre de catégorie : « U10-U11 » garde aussi les exercices communs aux quatre catégories, « U12-U13 » de même.
type CategoryFilter = "all" | "U10-U11" | "U12-U13";
const categoryFilters: ReadonlyArray<{ value: CategoryFilter; label: string }> = [
  { value: "all", label: "Toutes catégories" },
  { value: "U10-U11", label: "U10-U11" },
  { value: "U12-U13", label: "U12-U13" },
];

function inCategory(activity: TrainingActivity, filter: CategoryFilter): boolean {
  return filter === "all" || !activity.category || activity.category === "U10-U13" || activity.category === filter;
}

function matchesQuery(activity: TrainingActivity, query: string) {
  const haystack = `${activity.title} ${activity.objective}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export function BibliothequeBrowser() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<TrainingBlockKind | "all">("all");
  const [theme, setTheme] = useState<DevelopmentTheme | "all">("all");
  // Tout le catalogue par défaut ; le filtre garde une catégorie (et les exercices communs).
  const [category, setCategory] = useState<CategoryFilter>("all");

  const activities = useMemo(
    () =>
      trainingActivityCatalogue.filter(
        (activity) =>
          (kind === "all" || activity.kind === kind) &&
          (theme === "all" || activity.compatibleThemes.includes(theme)) &&
          inCategory(activity, category) &&
          matchesQuery(activity, query),
      ),
    [category, kind, query, theme],
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
        <div className="bibliotheque-filters" role="group" aria-label="Filtrer par catégorie">
          {categoryFilters.map((filter) => (
            <button
              aria-pressed={category === filter.value}
              className={category === filter.value ? "active" : ""}
              key={filter.value}
              onClick={() => setCategory(filter.value)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>
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
        <div className="bibliotheque-filters" role="group" aria-label="Filtrer par thème">
          {themeFilters.map((filter) => (
            <button aria-pressed={theme === filter} className={theme === filter ? "active" : ""} key={filter} onClick={() => setTheme(filter)} type="button">
              {filter === "all" ? "Tous les thèmes" : filter}
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
                <TacticalDiagramView diagram={activity.diagram} targets={diagramTargets(activity)} />
              </div>
              <div className="bibliotheque-card-body">
                <div className="bibliotheque-card-meta">
                  <span>{kindLabels[activity.kind]}</span>
                  <span>{activity.fieldSize}</span>
                </div>
                {activity.category ? <span className="activity-category-tag">{activityCategoryLabels[activity.category]}</span> : null}
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
