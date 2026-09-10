"use client";

import { gameFormats, listFormations } from "@evolyfoot/domain";
import type { GameFormat, MatchStatus, MatchVenue } from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CompetitionsPanel } from "./competitions-panel";

interface MatchSummary {
  id: string;
  opponent: string;
  dateLabel: string;
  venue: MatchVenue;
  gameFormat: number;
  status: MatchStatus;
  lineup: ReadonlyArray<unknown>;
}

interface TeamSummary {
  gameFormat: number;
}

const statusLabel: Record<MatchStatus, string> = { scheduled: "À venir", played: "Joué" };
const venueLabel: Record<MatchVenue, string> = { home: "Domicile", away: "Extérieur" };

async function readErrorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({}));
  return typeof body.error === "string" ? body.error : "Une erreur est survenue.";
}

export function MatchListView() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | undefined>(undefined);
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [creating, setCreating] = useState(false);
  const [opponent, setOpponent] = useState("");
  const [dateLabel, setDateLabel] = useState("");
  const [venue, setVenue] = useState<MatchVenue>("home");
  const [gameFormat, setGameFormat] = useState<GameFormat>(8);
  // `null` tant que le coach n'a pas explicitement choisi une formation : reprend la première du
  // format de jeu courant au moment de la création plutôt que d'être copiée dans un état séparé à
  // chaque changement de format (éviterait un rendu en cascade, même correctif que sidebar-nav.tsx).
  const [selectedFormationId, setSelectedFormationId] = useState<string | null>(null);
  const availableFormations = listFormations(gameFormat);
  const formationId = availableFormations.some((formation) => formation.id === selectedFormationId) ? selectedFormationId! : availableFormations[0]!.id;
  const [createError, setCreateError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

        const [matchesResponse, teamResponse] = await Promise.all([fetch("/api/matches"), fetch("/api/team")]);
        const matchesBody = await matchesResponse.json().catch(() => ({ matches: [] }));
        const teamBody = await teamResponse.json().catch(() => ({ profile: null }));
        if (cancelled) {
          return;
        }
        setMatches(matchesBody.matches ?? []);
        const team: TeamSummary | null = teamBody.profile ?? null;
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
      const response = await fetch("/api/matches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ opponent, dateLabel, venue, gameFormat, formationId }),
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
        <Link className="onboarding-brand" href="/app">
          <span className="brand-mark">E</span> EvolyFoot
        </Link>
        <div>
          <span className="eyebrow light">MATCHS &amp; COMPÉTITIONS</span>
          <h1 title="Prépare tes matchs, note tes compétitions.">Prépare tes matchs, note tes compétitions.</h1>
          <p title="Compose ton équipe et observe le match une fois joué ; garde aussi une trace de tes tournois et plateaux.">
            Compose ton équipe et observe le match une fois joué ; garde aussi une trace de tes tournois et plateaux.
          </p>
        </div>
      </header>

      {authenticated === false && (
        <section className="match-auth-required" role="status">
          <p>
            Connecte-toi pour préparer tes matchs. <Link className="inline-cta" href="/connexion">Se connecter →</Link>
          </p>
        </section>
      )}

      {authenticated && (
        <section className="match-content">
          {!creating ? (
            <button className="match-new-button" onClick={() => setCreating(true)} type="button">
              + Nouveau match
            </button>
          ) : (
            <form className="match-create-form" onSubmit={createMatch}>
              <div className="form-row">
                <label>
                  Équipe adverse
                  <input onChange={(event) => setOpponent(event.target.value)} placeholder="Ex. US Vallée" value={opponent} />
                </label>
                <label>
                  Date
                  <input onChange={(event) => setDateLabel(event.target.value)} placeholder="Ex. Samedi 12 septembre · 10:30" value={dateLabel} />
                </label>
              </div>
              <div className="form-row">
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
                  Format de jeu
                  <select onChange={(event) => setGameFormat(Number(event.target.value) as GameFormat)} value={gameFormat}>
                    {gameFormats.map((format) => (
                      <option key={format} value={format}>
                        Foot à {format}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
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
              {createError && <p className="field-error" role="alert">{createError}</p>}
              <div className="match-create-actions">
                <button disabled={submitting} type="submit">
                  {submitting ? "Création…" : "Créer le match"}
                </button>
                <button onClick={() => setCreating(false)} type="button">
                  Annuler
                </button>
              </div>
            </form>
          )}

          {matches.length === 0 ? (
            <p className="match-empty">Aucun match préparé pour l’instant.</p>
          ) : (
            <ul className="match-list" aria-label="Matchs">
              {matches.map((match) => (
                <li key={match.id}>
                  <Link
                    aria-label={`${match.opponent} — ${match.status === "played" ? "Voir la composition" : "Préparer la composition"}`}
                    className="match-card card-link"
                    href={`/match/${match.id}`}
                  >
                    <div className="match-card-top">
                      <span className={`match-status match-status-${match.status}`}>{statusLabel[match.status]}</span>
                      <span className="match-card-format">Foot à {match.gameFormat}</span>
                    </div>
                    <h2 aria-hidden="true">{match.opponent}</h2>
                    <p aria-hidden="true">
                      {match.dateLabel} · {venueLabel[match.venue]}
                    </p>
                    <p aria-hidden="true" className="match-card-lineup">
                      {match.lineup.length}/{match.gameFormat} postes pourvus
                    </p>
                    <span aria-hidden="true" className="match-card-link card-cta">
                      {match.status === "played" ? "Voir la composition →" : "Préparer la composition →"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <CompetitionsPanel
            endpoint="/api/tournaments"
            itemKey="tournament"
            listKey="tournaments"
            singular="tournoi"
            title="Tournois"
          />
          <CompetitionsPanel
            endpoint="/api/plateaux"
            itemKey="plateau"
            listKey="plateaux"
            singular="plateau"
            title="Plateaux"
          />

          <Link className="back-link" href="/app">
            Retour au tableau de bord
          </Link>
        </section>
      )}
    </main>
  );
}
