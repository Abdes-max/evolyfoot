"use client";

import { teamLineupMaxSubstitutes, type CompetitionLineup, type GameFormat } from "@evolyfoot/domain";
import { useEffect, useState } from "react";
import { CollapsibleSection } from "../collapsible-section";
import { CompetitionLineupEditor } from "../match/competition-lineup";

interface LineupPlayer {
  id: string;
  name: string;
  photo?: string | null;
  position?: string | null;
  jerseyNumber?: string | null;
}

// Compo type de l'équipe, sur la page Mon équipe : indépendante des matchs, avec 6 remplaçants au
// plus. Elle sert de point de départ pour la composition d'un tournoi ou d'un plateau.
export function TeamLineup({ players, gameFormat }: { players: readonly LineupPlayer[]; gameFormat: GameFormat }) {
  const [lineup, setLineup] = useState<CompetitionLineup | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await fetch("/api/team/lineup").catch(() => null);
      const body = response?.ok ? await response.json().catch(() => null) : null;
      if (!cancelled) setLineup(body?.lineup ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (lineup === undefined) return null;

  return (
    <section aria-label="Compo type" className="roster-lineup">
      <CollapsibleSection
        summary={
          lineup?.lineup.length
            ? `${lineup.lineup.length} titulaires · ${lineup.substitutePlayerIds.length} remplaçants · foot à ${lineup.gameFormat}`
            : "Facultative"
        }
        title="Compo type"
      >
        <p className="match-slot-hint event-hint">Ta composition de référence, sans lien avec un match : jusqu’à {teamLineupMaxSubstitutes} remplaçants.</p>
        <CompetitionLineupEditor
          defaultGameFormat={gameFormat}
          initial={lineup}
          lineupUrl="/api/team/lineup"
          maxBench={teamLineupMaxSubstitutes}
          players={players}
          startLabel="Préparer la compo type"
        />
      </CollapsibleSection>
    </section>
  );
}
