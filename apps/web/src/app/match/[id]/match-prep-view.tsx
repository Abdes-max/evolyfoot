"use client";

import {
  addSubstitute,
  assignPlayerToSlot,
  attendanceStatusLabels,
  canFinalizeMatchPlan,
  clearSlot,
  formationSlots,
  listFormations,
  removeSubstitute,
} from "@evolyfoot/domain";
import type { AttendanceEntry, GameFormat, MatchLineupAssignment, MatchPlan, MatchStatus, MatchVenue } from "@evolyfoot/domain";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { initials, MatchPitch } from "../match-pitch";

interface MatchRecord {
  id: string;
  opponent: string;
  dateLabel: string;
  meetingTime: string | null;
  location: string | null;
  description: string | null;
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
  // Rendez-vous, lieu et description -- affichés sur la page de détail du joueur/tuteur
  // (/joueur/matches/:id). Champs texte libres, initialisés au chargement du match (voir
  // l'effet ci-dessous) puis enregistrés indépendamment de la composition.
  const [meetingTime, setMeetingTime] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [sendingConvocation, setSendingConvocation] = useState(false);
  const [convocationFeedback, setConvocationFeedback] = useState<string | null>(null);
  // Un clic sur un poste directement sur le terrain (MatchPitch) ouvre le sélecteur natif
  // correspondant plutôt que dupliquer la logique d'affectation dans un second composant --
  // `showPicker()` (Chrome/Edge) ouvre le menu déroulant sans clic réel dessus ; `focus()` reste
  // le repli pour les navigateurs qui ne le supportent pas encore (l'utilisateur n'a alors plus
  // qu'à appuyer une fois, le focus étant déjà sur le bon poste).
  const selectRefs = useRef<Record<string, HTMLSelectElement | null>>({});
  // Même principe pour les pastilles rondes du banc (voir plus bas), indexées par position
  // affichée plutôt que par id de poste -- le banc n'a pas de position fixe comme le terrain.
  const benchSelectRefs = useRef<Record<number, HTMLSelectElement | null>>({});

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
        setMeetingTime(matchBody.match?.meetingTime ?? "");
        setLocation(matchBody.match?.location ?? "");
        setDescription(matchBody.match?.description ?? "");
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

  function openPicker(select: HTMLSelectElement | null | undefined) {
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

  function openSlotPicker(slotId: string) {
    openPicker(selectRefs.current[slotId]);
  }

  function openBenchPicker(index: number) {
    openPicker(benchSelectRefs.current[index]);
  }

  // Une seule opération domaine par appel (jamais retirer PUIS ajouter dans le même clic) : les
  // deux s'appuieraient sur `match` via `toPlan()`, qui n'a pas encore vu le premier `setMatch`
  // optimiste de persistLineup au moment du second appel synchrone -- le second écraserait le
  // premier. Une pastille de banc déjà occupée n'offre donc que "retirer" dans son sélecteur
  // (voir le rendu plus bas), jamais un remplacement direct par un autre joueur.
  function setBenchSlot(index: number, playerId: string) {
    if (!playerId) {
      const current = match?.substitutePlayerIds[index];
      if (current) {
        removeSubstitutePlayer(current);
      }
      return;
    }
    addSubstitutePlayer(playerId);
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

  async function saveDetails(event: FormEvent) {
    event.preventDefault();
    setSavingDetails(true);
    setSaveError("");
    try {
      const response = await fetch(`/api/matches/${matchId}/details`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ meetingTime, location, description }),
      });
      if (!response.ok) {
        setSaveError(await readErrorMessage(response));
        return;
      }
      const body = await response.json();
      setMatch(body.match);
    } catch {
      setSaveError("Une erreur est survenue.");
    } finally {
      setSavingDetails(false);
    }
  }

  // Envoie un message de convocation (via la messagerie) à chaque joueur de la composition
  // retenue -- voir ConvocationService côté base. Pas de blocage si déjà envoyée : renvoyer
  // (composition modifiée, rappel...) est un geste volontaire du coach.
  async function sendConvocation() {
    setSendingConvocation(true);
    setConvocationFeedback(null);
    try {
      const response = await fetch(`/api/matches/${matchId}/convoke`, { method: "POST" });
      if (!response.ok) {
        setConvocationFeedback(await readErrorMessage(response));
        return;
      }
      const body = await response.json();
      setConvocationFeedback(`Convocation envoyée à ${body.sentCount} joueur${body.sentCount > 1 ? "s" : ""}.`);
    } catch {
      setConvocationFeedback("Une erreur est survenue.");
    } finally {
      setSendingConvocation(false);
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
  // Toujours au moins 4 pastilles -- même langage visuel que le terrain (pastille vide/pleine),
  // voir setBenchSlot ci-dessus. S'il y a déjà plus de 4 remplaçants enregistrés, une pastille de
  // plus par joueur en trop plutôt que d'en perdre l'affichage.
  const benchSlots: Array<string | null> = Array.from(
    { length: Math.max(4, match.substitutePlayerIds.length) },
    (_, index) => match.substitutePlayerIds[index] ?? null,
  );

  return (
    <main className="match-shell">
      <header className="page-header match-header">
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
          <MatchPitch
            captainPlayerId={match.captainPlayerId}
            lineup={match.lineup}
            onSlotClear={readOnly ? undefined : (slotId) => assignSlot(slotId, "")}
            onSlotClick={readOnly ? undefined : openSlotPicker}
            slots={slots}
          />
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
            <div aria-label="Remplaçants" className="match-bench-tokens" role="group">
              {benchSlots.map((playerId, index) => {
                const player = playerId ? roster.find((candidate) => candidate.id === playerId) : null;
                const label = player ? `Remplaçant : ${player.name}` : "Remplaçant : aucun joueur, toucher pour affecter";
                return (
                  <button
                    aria-label={label}
                    className={`match-pitch-token ${player ? "filled" : "empty"}`}
                    disabled={readOnly}
                    key={index}
                    onClick={() => openBenchPicker(index)}
                    type="button"
                  >
                    {player ? initials(player.name) : "+"}
                  </button>
                );
              })}
            </div>

            {/* Même principe que les <select> masqués du terrain plus haut : c'est sur eux
                qu'openBenchPicker() appelle showPicker()/focus(). Une pastille déjà occupée n'offre
                que "— Aucun joueur —" (retirer) -- jamais un remplacement direct, voir
                setBenchSlot ci-dessus. */}
            <div className="visually-hidden">
              {benchSlots.map((playerId, index) => (
                <label key={index}>
                  {`Remplaçant ${index + 1}`}
                  <select
                    disabled={readOnly}
                    onChange={(event) => setBenchSlot(index, event.target.value)}
                    ref={(element) => {
                      benchSelectRefs.current[index] = element;
                    }}
                    value={playerId ?? ""}
                  >
                    <option value="">— Aucun joueur —</option>
                    {playerId ? (
                      <option value={playerId}>{roster.find((candidate) => candidate.id === playerId)?.name ?? "Joueur"}</option>
                    ) : (
                      roster
                        .filter((player) => !assignedPlayerIds.has(player.id) && !match.substitutePlayerIds.includes(player.id))
                        .map((player) => (
                          <option key={player.id} value={player.id}>
                            {player.name}
                          </option>
                        ))
                    )}
                  </select>
                </label>
              ))}
            </div>
          </section>
        </div>

        <div className="match-slot-panel">
          <form className="match-details-form" onSubmit={saveDetails}>
            <h2>Détails</h2>
            <p className="match-slot-hint">Affichés sur la fiche que voit le joueur/tuteur.</p>
            <label>
              <span>Rendez-vous</span>
              <input
                disabled={readOnly}
                onChange={(event) => setMeetingTime(event.target.value)}
                placeholder="Ex. 14:30"
                value={meetingTime}
              />
            </label>
            <label>
              <span>Lieu</span>
              <input
                disabled={readOnly}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Ex. Stade Marius Requier, Aix-en-Provence"
                value={location}
              />
            </label>
            <label>
              <span>Description</span>
              <textarea disabled={readOnly} onChange={(event) => setDescription(event.target.value)} value={description} />
            </label>
            {!readOnly && (
              <button className="match-details-save" disabled={savingDetails} type="submit">
                {savingDetails ? "Enregistrement…" : "Enregistrer les détails"}
              </button>
            )}
          </form>

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

          {!readOnly && (
            <div className="match-convocation">
              <button className="match-convocation-send" disabled={sendingConvocation || match.lineup.length === 0} onClick={sendConvocation} type="button">
                {sendingConvocation ? "Envoi…" : "Envoyer la convocation"}
              </button>
              {match.lineup.length === 0 && <p className="match-slot-hint">Compose l’équipe pour pouvoir convoquer.</p>}
              {convocationFeedback && <p className="match-convocation-feedback">{convocationFeedback}</p>}
            </div>
          )}

          {!readOnly && roster.length > 0 && (
            <section aria-labelledby="match-attendance-title" className="match-attendance">
              <h2 id="match-attendance-title">Présence</h2>
              <p>Décoche les joueurs absents.</p>
              <ul className="match-attendance-list">
                {roster.map((player) => {
                  const present = !absentPlayerIds.has(player.id);
                  // Réponse déjà laissée par le joueur/tuteur à sa convocation (voir
                  // match-detail-view.tsx côté joueur) -- motif et commentaire éventuel, envoyé
                  // par ailleurs au coach dans le fil de messagerie (voir MessagingThread).
                  const rsvp = match.attendance?.find((entry) => entry.playerId === player.id);
                  return (
                    <li key={player.id}>
                      <label className={present ? "" : "absent"}>
                        <input checked={present} onChange={() => toggleAttendance(player.id)} type="checkbox" />
                        {player.name}
                      </label>
                      {rsvp?.status && rsvp.status !== "present" && (
                        <p className="match-attendance-rsvp">
                          {attendanceStatusLabels[rsvp.status]}
                          {rsvp.comment && <> — « {rsvp.comment} »</>}
                        </p>
                      )}
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
