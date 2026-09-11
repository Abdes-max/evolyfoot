"use client";

import {
  addSubstitute,
  assignPlayerToSlot,
  canFinalizeMatchPlan,
  clearSlot,
  formationSlots,
  listFormations,
  removeSubstitute,
} from "@evolyfoot/domain";
import type { AttendanceEntry, GameFormat, MatchLineupAssignment, MatchPlan, MatchStatus, MatchVenue } from "@evolyfoot/domain";
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
  substitutePlayerIds: string[];
  attendance?: AttendanceEntry[];
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
  // Même principe que session-builder.tsx : un ensemble d'absents plutôt qu'une carte complète
  // pré-remplie pour tout l'effectif, pour ne pas avoir à la recopier depuis `roster` via un
  // useEffect à chaque chargement.
  const [absentPlayerIds, setAbsentPlayerIds] = useState<ReadonlySet<string>>(new Set());
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
        // Pré-coche les absents déjà connus -- notamment un joueur/tuteur qui a répondu à sa
        // convocation avant même que le coach n'ouvre cette page (voir player-rsvp-service.ts) :
        // sans ce pré-remplissage, valider écraserait sa réponse par "présent" par défaut.
        const knownAbsentees: string[] = (matchBody.match?.attendance ?? [])
          .filter((entry: AttendanceEntry) => !entry.present)
          .map((entry: AttendanceEntry) => entry.playerId);
        setAbsentPlayerIds(new Set(knownAbsentees));
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

  async function persistLineup(plan: MatchPlan) {
    if (!match) {
      return;
    }
    setSaveError("");
    // Optimiste : la composition affichée change tout de suite, avant la confirmation serveur --
    // cohérent avec le reste de l'application (roster-view.tsx fait de même sur l'ajout d'un
    // joueur), l'échec reste rare et se rattrape par une nouvelle tentative.
    setMatch({
      ...match,
      lineup: [...plan.lineup],
      captainPlayerId: plan.captainPlayerId,
      substitutePlayerIds: [...plan.substitutePlayerIds],
    });
    try {
      const response = await fetch(`/api/matches/${matchId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lineup: plan.lineup,
          captainPlayerId: plan.captainPlayerId,
          substitutePlayerIds: plan.substitutePlayerIds,
        }),
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
      persistLineup(clearSlot(toPlan(match), slotId));
      return;
    }
    const player = roster.find((candidate) => candidate.id === playerId);
    if (!player) {
      return;
    }
    persistLineup(assignPlayerToSlot(toPlan(match), slotId, player));
  }

  function addSubstitutePlayer(playerId: string) {
    if (!match || !playerId) {
      return;
    }
    const player = roster.find((candidate) => candidate.id === playerId);
    if (!player) {
      return;
    }
    persistLineup(addSubstitute(toPlan(match), player));
  }

  function removeSubstitutePlayer(playerId: string) {
    if (!match) {
      return;
    }
    persistLineup(removeSubstitute(toPlan(match), playerId));
  }

  function setCaptainPlayer(playerId: string) {
    if (!match) {
      return;
    }
    persistLineup({ ...toPlan(match), captainPlayerId: playerId || null });
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

  function toggleAttendance(playerId: string) {
    setAbsentPlayerIds((current) => {
      const next = new Set(current);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  }

  async function finalize() {
    setFinalizing(true);
    setSaveError("");
    try {
      const attendance: AttendanceEntry[] = roster.map((player) => {
        const present = !absentPlayerIds.has(player.id);
        // Le motif détaillé (malade, blessé…) éventuellement déjà donné par le joueur/tuteur est
        // conservé tant que la case à cocher du coach correspond toujours à ce qu'il avait
        // répondu -- décochée/cochée différemment, elle exprime une correction du coach, qui n'a
        // que présent/absent à disposition ici.
        const known = match?.attendance?.find((entry) => entry.playerId === player.id);
        if (known && known.present === present) {
          return known;
        }
        return { playerId: player.id, playerName: player.name, present };
      });
      const response = await fetch(`/api/matches/${matchId}/played`, {
        method: "POST",
        ...(attendance.length > 0
          ? { headers: { "content-type": "application/json" }, body: JSON.stringify({ attendance }) }
          : {}),
      });
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
      <header className="page-header match-header">
        <Link className="onboarding-brand" href="/app">
          <span className="brand-mark">E</span> EvolyFoot
        </Link>
        <div>
          <span className="eyebrow light">{match.status === "played" ? "MATCH JOUÉ" : "PRÉPARATION DU MATCH"}</span>
          <h1 title={match.opponent}>{match.opponent}</h1>
          <p title={`${match.dateLabel} · ${venueLabel[match.venue]} · Foot à ${match.gameFormat}`}>
            {match.dateLabel} · {venueLabel[match.venue]} · Foot à {match.gameFormat}
          </p>
        </div>
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
          {!readOnly && <p className="match-slot-hint">Touche un poste sur le terrain pour y affecter un joueur.</p>}

          {/* Les <select> réels restent dans le DOM (masqués visuellement, pas retirés) : c'est
              sur eux qu'openSlotPicker() appelle showPicker()/focus() quand on touche un poste sur
              le terrain -- la seule affectation possible désormais, la liste à côté du terrain
              n'ayant pas de sens (deux façons de faire la même chose). */}
          <div className="visually-hidden">
            {slots.map((slot) => {
              const assignment = match.lineup.find((candidate) => candidate.slotId === slot.id);
              return (
                <label key={slot.id}>
                  {slot.roleLabel}
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

          <section aria-labelledby="match-bench-title" className="match-bench">
            <h2 id="match-bench-title">Remplaçants</h2>
            {match.substitutePlayerIds.length === 0 ? (
              <p className="player-space-empty">Aucun remplaçant.</p>
            ) : (
              <ul className="match-bench-list">
                {match.substitutePlayerIds.map((playerId) => {
                  const player = roster.find((candidate) => candidate.id === playerId);
                  return (
                    <li key={playerId}>
                      <span>{player?.name ?? "Joueur"}</span>
                      {!readOnly && (
                        <button aria-label={`Retirer ${player?.name ?? "ce joueur"} du banc`} onClick={() => removeSubstitutePlayer(playerId)} type="button">
                          ×
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {!readOnly && (
              <label className="match-bench-add">
                <span>Ajouter un remplaçant</span>
                <select
                  onChange={(event) => {
                    addSubstitutePlayer(event.target.value);
                    event.target.value = "";
                  }}
                  value=""
                >
                  <option value="">— Choisir un joueur —</option>
                  {roster
                    .filter((player) => !assignedPlayerIds.has(player.id) && !match.substitutePlayerIds.includes(player.id))
                    .map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
          </section>
        </div>

        <div className="match-slot-panel">
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

          {!readOnly && roster.length > 0 && (
            <section aria-labelledby="match-attendance-title" className="match-attendance">
              <h2 id="match-attendance-title">Présence</h2>
              <p>Décoche les joueurs absents.</p>
              <ul className="match-attendance-list">
                {roster.map((player) => {
                  const present = !absentPlayerIds.has(player.id);
                  return (
                    <li key={player.id}>
                      <label className={present ? "" : "absent"}>
                        <input checked={present} onChange={() => toggleAttendance(player.id)} type="checkbox" />
                        {player.name}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

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
    substitutePlayerIds: match.substitutePlayerIds,
  };
}
