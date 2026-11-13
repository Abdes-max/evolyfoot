"use client";

import { matchesInScope, matchScopeLabels, type MatchScope, gameFormats, listFormations } from "@evolyfoot/domain";
import type { AttendanceEntry, GameFormat, MatchStatus, MatchVenue, PlayerSelection } from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { frenchDateLabel, parseDatetimeInputValue } from "../date-format";
import { ConcernedPlayersPicker, type ConcernedPlayer } from "../concerned-players-picker";
import { ConvocationSummary } from "../convocation-summary";
import { CalendarIcon, PinIcon } from "../icons";
import { PlaceInput } from "../place-input";
import { CalendarImport } from "./calendar-import";
import { CompetitionsPanel } from "./competitions-panel";

interface MatchSummary {
  id: string;
  opponent: string;
  dateLabel: string;
  date: string | null;
  venue: MatchVenue;
  location?: string | null;
  gameFormat: number;
  status: MatchStatus;
  lineup: ReadonlyArray<unknown>;
  goalsFor?: number | null;
  goalsAgainst?: number | null;
  // Annulé par le coach (ISO).
  cancelledAt?: string | null;
  convokedAt?: string | null;
  attendance?: AttendanceEntry[];
  selectedPlayerIds?: PlayerSelection;
}

interface TeamSummary {
  name: string;
  gameFormat: number;
}

const statusLabel: Record<MatchStatus, string> = { scheduled: "À venir", played: "Joué" };
const venueLabel: Record<MatchVenue, string> = { home: "Domicile", away: "Extérieur" };

// Score d'un match joué, en vert pour une victoire, en rouge pour une défaite ; sinon rappel de le saisir.
function MatchScore({ match }: { match: MatchSummary }) {
  if (match.goalsFor == null || match.goalsAgainst == null) {
    return <p className="match-card-score missing">Résultat à saisir</p>;
  }
  const outcome = match.goalsFor > match.goalsAgainst ? "win" : match.goalsFor < match.goalsAgainst ? "loss" : "draw";
  return (
    <p className={`match-card-score ${outcome}`}>
      Score : {match.goalsFor} – {match.goalsAgainst}
    </p>
  );
}

async function readErrorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({}));
  return typeof body.error === "string" ? body.error : "Une erreur est survenue.";
}

export function MatchListView() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | undefined>(undefined);
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  // Filtre À venir / Passés, comme dans l'app Coach : s'applique aux matchs, tournois et plateaux.
  const [scope, setScope] = useState<MatchScope>("upcoming");
  const [now] = useState(() => Date.now());
  const [teamName, setTeamName] = useState("");
  const [creating, setCreating] = useState(false);
  const [opponent, setOpponent] = useState("");
  // "YYYY-MM-DDTHH:mm" (valeur brute d'un <input type="datetime-local">) -- dateLabel ("Samedi 12
  // septembre") est dérivé automatiquement à l'envoi, voir createMatch ci-dessous ; l'heure elle-
  // même reste dans `date` (coup d'envoi réel).
  const [dateInput, setDateInput] = useState("");
  const [venue, setVenue] = useState<MatchVenue>("home");
  const [location, setLocation] = useState("");
  const [gameFormat, setGameFormat] = useState<GameFormat>(8);
  // `null` tant que le coach n'a pas explicitement choisi une formation : reprend la première du
  // format de jeu courant au moment de la création plutôt que d'être copiée dans un état séparé à
  // chaque changement de format (éviterait un rendu en cascade, même correctif que sidebar-nav.tsx).
  const [selectedFormationId, setSelectedFormationId] = useState<string | null>(null);
  const availableFormations = listFormations(gameFormat);
  const formationId = availableFormations.some((formation) => formation.id === selectedFormationId) ? selectedFormationId! : availableFormations[0]!.id;
  const [createError, setCreateError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [roster, setRoster] = useState<ConcernedPlayer[]>([]);
  // Joueurs concernés, tout l'effectif par défaut (voir ConcernedPlayersPicker).
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<PlayerSelection>(null);

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

        const [matchesResponse, teamResponse, profileResponse, rosterResponse] = await Promise.all([
          fetch("/api/matches"),
          fetch("/api/team"),
          fetch("/api/profile"),
          fetch("/api/roster"),
        ]);
        const rosterBody = await rosterResponse.json().catch(() => ({ players: [] }));
        const matchesBody = await matchesResponse.json().catch(() => ({ matches: [] }));
        const teamBody = await teamResponse.json().catch(() => ({ profile: null }));
        const profileBody = await profileResponse.json().catch(() => ({ profile: null }));
        if (cancelled) {
          return;
        }
        setMatches(matchesBody.matches ?? []);
        setRoster(rosterBody.players ?? []);
        setSelectedFormationId(profileBody.profile?.preferredFormation ?? null);
        const team: TeamSummary | null = teamBody.profile ?? null;
        setTeamName(team?.name ?? "");
        if (team && gameFormats.includes(team.gameFormat as GameFormat)) {
          setGameFormat(team.gameFormat as GameFormat);
        }
      } catch {
        if (!cancelled) {
          setAuthenticated(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function createMatch(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setCreateError("");
    try {
      const date = parseDatetimeInputValue(dateInput);
      const response = await fetch("/api/matches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          opponent,
          dateLabel: date ? frenchDateLabel(date) : dateInput,
          date: date ? date.toISOString() : null,
          venue,
          ...(location.trim() ? { location: location.trim() } : {}),
          gameFormat,
          formationId,
          selectedPlayerIds,
        }),
      });
      if (!response.ok) {
        setCreateError(await readErrorMessage(response));
        return;
      }
      const body = await response.json();
      router.push(`/match/${body.match.id}`);
    } catch {
      setCreateError("Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="match-shell">
      <header className="page-header match-header">
        <div>
          <span className="eyebrow light">MATCHS</span>
          <h1 title="Prépare et suis tes matchs.">Prépare et suis tes matchs.</h1>
          <p>
            Compose ton équipe, désigne un capitaine, puis observe le match une fois joué pour ajuster tes prochaines séances si nécessaire. Garde aussi une
            trace de tes tournois et plateaux.
          </p>
        </div>
      </header>

      {authenticated === false && (
        <section className="match-auth-required" role="status">
          <p>
            Connecte-toi pour préparer tes matchs.{" "}
            <Link className="inline-cta" href="/connexion">
              Se connecter →
            </Link>
          </p>
        </section>
      )}

      {authenticated && (
        <section className="match-content match-list-screen">
          {!creating ? (
            <>
              <button className="match-new-button" onClick={() => setCreating(true)} type="button">
                + Nouveau match
              </button>
              <CalendarImport<MatchSummary>
                existing={matches}
                formationId={formationId}
                gameFormat={gameFormat}
                onImported={(created) => setMatches((current) => [...created, ...current])}
                teamName={teamName}
              />
            </>
          ) : (
            <form className="match-create-form" onSubmit={createMatch}>
              <label>
                Équipe adverse
                <input onChange={(event) => setOpponent(event.target.value)} placeholder="Ex. US Vallée" value={opponent} />
              </label>
              <label>
                Date
                <input onChange={(event) => setDateInput(event.target.value)} required type="datetime-local" value={dateInput} />
              </label>
              <fieldset>
                <legend>Lieu</legend>
                <div className="choice-grid">
                  {(["home", "away"] as const).map((option) => (
                    <button
                      aria-pressed={venue === option}
                      className={venue === option ? "choice active" : "choice"}
                      key={option}
                      onClick={() => setVenue(option)}
                      type="button"
                    >
                      {venueLabel[option]}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label>
                Adresse du terrain
                <PlaceInput onChange={setLocation} value={location} />
              </label>
              <fieldset>
                <legend>Format de jeu</legend>
                <div className="choice-grid">
                  {gameFormats.map((format) => (
                    <button
                      aria-pressed={gameFormat === format}
                      className={gameFormat === format ? "choice active" : "choice"}
                      key={format}
                      onClick={() => setGameFormat(format)}
                      type="button"
                    >
                      {format}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>Formation</legend>
                <div className="choice-grid">
                  {availableFormations.map((formation) => (
                    <button
                      aria-pressed={formation.id === formationId}
                      className={formation.id === formationId ? "choice active" : "choice"}
                      key={formation.id}
                      onClick={() => setSelectedFormationId(formation.id)}
                      type="button"
                    >
                      {formation.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <ConcernedPlayersPicker
                hint="Seuls les joueurs cochés voient le match, reçoivent la convocation et entrent dans la composition."
                onChange={setSelectedPlayerIds}
                roster={roster}
                value={selectedPlayerIds}
              />
              {createError && (
                <p className="field-error" role="alert">
                  {createError}
                </p>
              )}
              <div className="match-create-actions">
                <button disabled={submitting || selectedPlayerIds?.length === 0} type="submit">
                  {submitting ? "Création…" : "Créer le match"}
                </button>
                <button onClick={() => setCreating(false)} type="button">
                  Annuler
                </button>
              </div>
            </form>
          )}

          <div aria-label="Période" className="match-scope-filters" role="group">
            {(["upcoming", "past"] as const).map((value) => (
              <button
                aria-pressed={scope === value}
                className={scope === value ? "active" : undefined}
                key={value}
                onClick={() => setScope(value)}
                type="button"
              >
                {matchScopeLabels[value]}
              </button>
            ))}
          </div>

          {matches.length === 0 ? (
            <p className="match-empty">Aucun match préparé pour l’instant.</p>
          ) : matchesInScope(matches, scope, now).length === 0 ? (
            <p className="match-empty">{scope === "past" ? "Aucun match passé." : "Aucun match à venir."}</p>
          ) : (
            <ul className="match-list" aria-label="Matchs">
              {matchesInScope(matches, scope, now).map((match) => (
                <li key={match.id}>
                  <Link
                    aria-label={`${match.opponent} — ${match.cancelledAt ? "Voir le match annulé" : match.status === "played" ? "Voir la composition" : "Préparer la composition"}`}
                    className="match-card card-link"
                    href={`/match/${match.id}`}
                  >
                    <div className="match-card-top">
                      <span className={`match-status match-status-${match.status}${match.cancelledAt ? " status-cancelled" : ""}`}>
                        {match.cancelledAt ? "Annulé" : statusLabel[match.status]}
                      </span>
                      <span className="match-card-format">Foot à {match.gameFormat}</span>
                    </div>
                    <h2 aria-hidden="true">{match.opponent}</h2>
                    <p aria-hidden="true" className="match-card-meta">
                      <CalendarIcon />
                      {match.dateLabel} · {venueLabel[match.venue]}
                    </p>
                    {match.location && (
                      <p aria-hidden="true" className="match-card-meta">
                        <PinIcon />
                        {match.location}
                      </p>
                    )}
                    {match.status === "played" && <MatchScore match={match} />}
                    {(match.status === "scheduled" || match.convokedAt) && !match.cancelledAt && (
                      <ConvocationSummary
                        attendance={match.attendance}
                        convokedAt={match.convokedAt}
                        roster={roster}
                        selectedPlayerIds={match.selectedPlayerIds}
                      />
                    )}
                    {!match.cancelledAt && (
                      <span aria-hidden="true" className="match-card-link card-cta">
                        {match.status === "played" ? "Voir la composition →" : "Préparer la composition →"}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <CompetitionsPanel
            detailBasePath="/match/tournois"
            endpoint="/api/tournaments"
            itemKey="tournament"
            listKey="tournaments"
            scope={scope}
            singular="tournoi"
            title="Tournois"
          />
          <CompetitionsPanel
            detailBasePath="/match/plateaux"
            endpoint="/api/plateaux"
            itemKey="plateau"
            listKey="plateaux"
            scope={scope}
            singular="plateau"
            title="Plateaux"
          />
        </section>
      )}
    </main>
  );
}
