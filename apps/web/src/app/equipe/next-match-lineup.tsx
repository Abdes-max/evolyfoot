"use client";

import { formationSlots, type GameFormat, type MatchLineupAssignment, type MatchStatus } from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MatchPitch } from "../match/match-pitch";

interface MatchSummary {
  id: string;
  opponent: string;
  dateLabel: string;
  date: string | null;
  status: MatchStatus;
  gameFormat: number;
  formationId: string;
  lineup: MatchLineupAssignment[];
  captainPlayerId: string | null;
  substitutePlayerIds: string[];
}

// Composition du prochain match, sur la page Mon équipe : le terrain tel qu'il est préparé et le
// lien pour la construire (déplacée ici depuis la vue d'ensemble).
export function NextMatchLineup() {
  const [match, setMatch] = useState<MatchSummary | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await fetch("/api/matches").catch(() => null);
      const body = response?.ok ? await response.json().catch(() => null) : null;
      if (cancelled) return;
      const now = Date.now();
      // Le plus proche à venir, sinon le premier sans date (même règle que la vue d'ensemble).
      const next = ((body?.matches ?? []) as MatchSummary[])
        .filter((candidate) => candidate.status === "scheduled" && (!candidate.date || new Date(candidate.date).getTime() >= now - 3 * 3600_000))
        .sort((a, b) => (a.date ? new Date(a.date).getTime() : Infinity) - (b.date ? new Date(b.date).getTime() : Infinity))[0];
      setMatch(next ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (match === undefined) return null;

  return (
    <section aria-labelledby="roster-lineup-title" className="roster-lineup">
      <span className="roster-side-title" id="roster-lineup-title">
        COMPOSITION
      </span>
      {match ? (
        <>
          <p className="roster-lineup-match">
            Contre <strong>{match.opponent}</strong> · {match.dateLabel}
          </p>
          <div className="home-pitch">
            <MatchPitch
              captainPlayerId={match.captainPlayerId}
              lineup={match.lineup}
              slots={formationSlots(match.gameFormat as GameFormat, match.formationId)}
            />
          </div>
          <p className="roster-lineup-match">
            {match.lineup.length}/{match.gameFormat} postes · {match.substitutePlayerIds.length} remplaçant{match.substitutePlayerIds.length > 1 ? "s" : ""}
          </p>
          <Link className="small-primary roster-lineup-cta" href={`/match/${match.id}`}>
            {match.lineup.length > 0 ? "Modifier la composition" : "Construire la composition"} →
          </Link>
        </>
      ) : (
        <>
          <p className="roster-lineup-match">Ta composition s’affichera ici dès ton prochain match.</p>
          <Link className="small-primary roster-lineup-cta" href="/match">
            Préparer un match →
          </Link>
        </>
      )}
    </section>
  );
}
