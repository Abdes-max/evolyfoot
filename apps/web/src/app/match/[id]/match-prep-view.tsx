"use client";

import { assignPlayerToSlot, canFinalizeMatchPlan, clearSlot, formationSlots, listFormations } from "@evolyfoot/domain";
import type { GameFormat, MatchLineupAssignment, MatchPlan, MatchStatus, MatchVenue } from "@evolyfoot/domain";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MatchPitch } from "../match-pitch";

interface MatchRecord {
  id: string;
  opponent: string;
  dateLabel: string;
  venue: MatchVenue;
  gameFormat: number;
  formationId: string;
  status: MatchStatus;
  lineup: MatchLineupAssignment[];
  captainPlayerId: string | null;
}

interface RosterPlayer {
  id: string;
  name: string;
}

const venueLabel: Record<MatchVenue, string> = { home: "Domicile", away: "Extérieur" };

async function readErrorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({}));
  return typeof body.error === "string" ? body.error : "Une erreur est survenue.";
}

export function MatchPrepView({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | undefined>(undefined);
  const [match, setMatch] = useState<MatchRecord | null>(null);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  // Un clic sur un poste directement sur le terrain (MatchPitch) ouvre le sélecteur natif
  // correspondant plutôt que dupliquer la logique d'affectation dans un second composant --
  // `showPicker()` (Chrome/Edge) ouvre le menu déroulant sans clic réel dessus ; `focus()` reste
  // le repli pour les navigateurs qui ne le supportent pas encore (l'utilisateur n'a alors plus
  // qu'à appuyer une fois, le focus étant déjà sur le bon poste).
  const selectRefs = useRef<Record<string, HTMLSelectElement | null>>({});

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const sessionResponse = await fetch("/api/auth/session");
        const sessionBody = await sessionResponse.json().catch(() => ({ educator: null }));
        if (cancelled) {
          return;
        }
        const isAuthenticated = Boolean(sessionBody.educator);
        setAuthenticated(isAuthenticated);
        if (!isAuthenticated) {
          return;
        }

        const [matchResponse, rosterResponse] = await Promise.all([fetch(`/api/matches/${matchId}`), fetch("/api/roster")]);
        if (!matchResponse.ok) {
          setLoadError(await readErrorMessage(matchResponse));
          return;
        }
        const matchBody = await matchResponse.json();
        const rosterBody = await rosterResponse.json().catch(() => ({ players: [] }));
        if (cancelled) {
          return;
        }
        setMatch(matchBody.match);
        setRoster(rosterBody.players ?? []);
      } catch {
        if (!cancelled) {
          setLoadError("Une erreur est survenue.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [matchId]);

  async function persistLineup(nextLineup: MatchLineupAssignment[], nextCaptainPlayerId: string | null) {
    if (!match) {
      return;
    }
    setSaveError("");
    // Optimiste : la composition affichée change tout de suite, avant la confirmation serveur --
    // cohérent avec le reste de l'application (roster-view.tsx fait de même sur l'ajout d'un
    // joueur), l'échec reste rare et se rattrape par une nouvelle tentative.
    setMatch({ ...match, lineup: nextLineup, captainPlayerId: nextCaptainPlayerId });
    try {
      const response = await fetch(`/api/matches/${matchId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lineup: nextLineup, captainPlayerId: nextCaptainPlayerId }),
      });
      if (!response.ok) {
        setSaveError(await readErrorMessage(response));
        return;
      }
      const body = await response.json();
      setMatch(body.match);
    } catch {
      setSaveError("Une erreur est survenue.");
    }
  }

  function assignSlot(slotId: string, playerId: string) {
    if (!match) {
      return;
    }
    if (!playerId) {
      const plan = clearSlot(toPlan(match), slotId);
      persistLineup([...plan.lineup], plan.captainPlayerId);
      return;
    }
    const player = roster.find((candidate) => candidate.id === playerId);
    if (!player) {
      return;
    }
    const plan = assignPlayerToSlot(toPlan(match), slotId, player);
    persistLineup([...plan.lineup], plan.captainPlayerId);
  }

  function setCaptainPlayer(playerId: string) {
    if (!match) {
      return;
    }
    persistLineup(match.lineup, playerId || null);
  }

  function openSlotPicker(slotId: string) {
    const select = selectRefs.current[slotId];
    if (!select) {
      return;
    }
    if ("showPicker" in select) {
      try {
        (select as HTMLSelectElement & { showPicker: () => void }).showPicker();
        return;
      } catch {
        // Certains navigateurs exposent showPicker() mais le refusent dans certains contextes --
        // repli silencieux sur le focus ci-dessous plutôt que de casser le clic.
      }
    }
    select.focus();
  }

  async function changeFormation(formationId: string) {
    if (!match || formationId === match.formationId) {
      return;
    }
    setSaveError("");
    try {
      const response = await fetch(`/api/matches/${matchId}/formation`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ formationId }),
      });
      if (!response.ok) {
        setSaveError(await readErrorMessage(response));
        return;
      }
      const body = await response.json();
      setMatch(body.match);
    } catch {
      setSaveError("Une erreur est survenue.");
    }
  }

  async function finalize() {
    setFinalizing(true);
    setSaveError("");
    try {
      const response = await fetch(`/api/matches/${matchId}/played`, { method: "POST" });
      if (!response.ok) {
        setSaveError(await readErrorMessage(response));
        return;
      }
      router.push(`/observation?type=match&matchId=${matchId}`);
    } catch {
      setSaveError("Une erreur est survenue.");
    } finally {
      setFinalizing(false);
    }
  }

  if (authenticated === false) {
    return (
      <main className="match-shell">
        <section className="match-auth-required" role="status">
          <p>
            Connecte-toi pour préparer ce match. <Link className="inline-cta" href="/connexion">Se connecter →</Link>
          </p>
        </section>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="match-shell">
        <section className="match-content">
          <p className="field-error" role="alert">
            {loadError}
          </p>
          <Link className="back-link" href="/match">
            Retour aux matchs
          </Link>
        </section>
      </main>
    );
  }

  if (!match) {
    return <main className="match-shell" />;
  }

  const gameFormat = match.gameFormat as GameFormat;
  const formations = listFormations(gameFormat);
  const slots = formationSlots(gameFormat, match.formationId);
  const readOnly = match.status === "played";
  const assignedPlayerIds = new Set(match.lineup.map((assignment) => assignment.playerId));
  const canFinalize = canFinalizeMatchPlan(toPlan(match));

  return (
    <main className="match-shell">
      <header className="match-header">
        <Link className="onboarding-brand" href="/">
          <span className="brand-mark">E</span> EvolyFoot
        </Link>
        <span className="eyebrow light">{match.status === "played" ? "MATCH JOUÉ" : "PRÉPARATION DU MATCH"}</span>
        <h1>{match.opponent}</h1>
        <p>
          {match.dateLabel} · {venueLabel[match.venue]} · Foot à {match.gameFormat}
        </p>
      </header>

      <section className="match-content match-prep-layout">
        <div>
          {!readOnly && formations.length > 1 && (
            <div className="match-formation-picker" role="group" aria-label="Formation">
              {formations.map((formation) => (
                <button
                  aria-pressed={formation.id === match.formationId}
                  className={formation.id === match.formationId ? "choice active" : "choice"}
                  key={formation.id}
                  onClick={() => changeFormation(formation.id)}
                  type="button"
                >
                  {formation.label}
                </button>
              ))}
            </div>
          )}
          <MatchPitch captainPlayerId={match.captainPlayerId} lineup={match.lineup} onSlotClick={readOnly ? undefined : openSlotPicker} slots={slots} />
        </div>

        <div className="match-slot-panel">
          <h2>Composition</h2>
          <p className="match-slot-hint">Touche un poste sur le terrain pour y affecter un joueur, ou choisis-le directement ci-dessous.</p>
          <div className="match-slot-list">
            {slots.map((slot) => {
              const assignment = match.lineup.find((candidate) => candidate.slotId === slot.id);
              return (
                <label className="match-slot-row" key={slot.id}>
                  <span>{slot.roleLabel}</span>
                  <select
                    disabled={readOnly}
                    onChange={(event) => assignSlot(slot.id, event.target.value)}
                    ref={(element) => {
                      selectRefs.current[slot.id] = element;
                    }}
                    value={assignment?.playerId ?? ""}
                  >
                    <option value="">— Aucun joueur —</option>
                    {roster
                      .filter((player) => player.id === assignment?.playerId || !assignedPlayerIds.has(player.id))
                      .map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.name}
                        </option>
                      ))}
                  </select>
                </label>
              );
            })}
          </div>

          <label className="match-captain-row">
            <span>Capitaine</span>
            <select disabled={readOnly} onChange={(event) => setCaptainPlayer(event.target.value)} value={match.captainPlayerId ?? ""}>
              <option value="">— Aucun —</option>
              {match.lineup.map((assignment) => (
                <option key={assignment.playerId} value={assignment.playerId}>
                  {assignment.playerName}
                </option>
              ))}
            </select>
          </label>

          {saveError && (
            <p className="field-error" role="alert">
              {saveError}
            </p>
          )}

          {!readOnly && (
            <button className="continue-button" disabled={!canFinalize || finalizing} onClick={finalize} type="button">
              {finalizing ? "…" : "Marquer comme joué & observer"} <span aria-hidden="true">→</span>
            </button>
          )}
          {readOnly && (
            <Link className="continue-button" href={`/observation?type=match&matchId=${matchId}`}>
              Ajouter une observation <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      </section>

      <Link className="back-link match-back-link" href="/match">
        Retour aux matchs
      </Link>
    </main>
  );
}

function toPlan(match: MatchRecord): MatchPlan {
  return {
    opponent: match.opponent,
    dateLabel: match.dateLabel,
    venue: match.venue,
    gameFormat: match.gameFormat as GameFormat,
    formationId: match.formationId,
    status: match.status,
    lineup: match.lineup,
    captainPlayerId: match.captainPlayerId,
  };
}
