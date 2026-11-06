"use client";

import {
  buildPlayerEvaluationSeasons,
  playerEvaluationAspectLabels,
  playerEvaluationAspects,
  playerEvaluationMaxPerSeason,
  playerEvaluationMaxScore,
  playerEvaluationMinScore,
  playerFeet,
  playerPositions,
  playerSeasonTotals,
  seasonStartDate,
  type PlayerEvaluationScores,
  type PlayerSeasonTotals,
} from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { RadarChart } from "../../charts";
import { colorForEvaluation, defaultComparedEvaluationIds, evaluationLabel } from "../../evaluation-colors";
import { EvaluationSeasonsTable } from "../../evaluation-seasons-table";
import { resizeImageToDataUrl } from "../../image-resize";
import { cutoutPhoto } from "../../photo-cutout";
import { PhotoChoice } from "../../photo-choice";
import { MessagingThread } from "../../messaging-thread";
import { PlayerCard } from "../../player-card";
import { PrintButton } from "../../print-button";

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  photo: string | null;
  birthDate: string | null;
  phone: string | null;
  email: string | null;
  position: string | null;
  jerseyNumber: string | null;
  preferredFoot: string | null;
  strengths: string | null;
  workAreas: string | null;
}

interface Evaluation {
  source?: "coach" | "player";
  id: string;
  playerId: string;
  scores: PlayerEvaluationScores;
  createdAt: string;
}

const radarAxes = playerEvaluationAspects.map((aspect) => ({ key: aspect, label: playerEvaluationAspectLabels[aspect] }));

function midpointScores(): PlayerEvaluationScores {
  const midpoint = Math.round((playerEvaluationMinScore + playerEvaluationMaxScore) / 2);
  return Object.fromEntries(playerEvaluationAspects.map((aspect) => [aspect, midpoint])) as PlayerEvaluationScores;
}

function formatDate(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : parsed.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function formatBirthDate(value: string | null): string {
  if (!value) {
    return "—";
  }
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

// Assez de détail pour un détourage net, sans alourdir la fiche (PNG sans fond ~ 150 Ko).
const playerPhotoMaxSide = 400;

type DetailForm = {
  firstName: string;
  lastName: string;
  birthDate: string;
  phone: string;
  email: string;
  position: string;
  jerseyNumber: string;
  preferredFoot: string;
  strengths: string;
  workAreas: string;
};

const emptyDetailForm: DetailForm = {
  firstName: "",
  lastName: "",
  birthDate: "",
  phone: "",
  email: "",
  position: "",
  jerseyNumber: "",
  preferredFoot: "",
  strengths: "",
  workAreas: "",
};

export function PlayerDetailView({ playerId }: { playerId: string }) {
  const [status, setStatus] = useState<"loading" | "ready" | "not-found" | "unauthenticated">("loading");
  const [player, setPlayer] = useState<Player | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [season, setSeason] = useState<PlayerSeasonTotals>({ matches: 0, goals: 0, assists: 0 });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<DetailForm>(emptyDetailForm);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  // Photo choisie, en attente du choix « sans fond » / « avec le fond ».
  const [photoChoice, setPhotoChoice] = useState<{ original: string; cutout: string } | null>(null);

  const [newScores, setNewScores] = useState<PlayerEvaluationScores>(midpointScores);
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));
  // Non-vide = le formulaire modifie cette évaluation existante plutôt que d'en créer une
  // nouvelle (PATCH au lieu de POST, voir saveEvaluation).
  const [editingEvaluationId, setEditingEvaluationId] = useState<string | null>(null);
  const [addingEvaluation, setAddingEvaluation] = useState(false);
  const [evaluationError, setEvaluationError] = useState("");
  // Évaluations superposées sur le radar (voir RadarChart.series) -- les dernières de chaque source y sont
  // par défaut, comparer les autres est un choix explicite plutôt qu'un graphe surchargé d'emblée.
  const [comparedEvaluationIds, setComparedEvaluationIds] = useState<ReadonlySet<string>>(new Set());

  const [inviteUrl, setInviteUrl] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [invitingTutor, setInvitingTutor] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const sessionResponse = await fetch("/api/auth/session");
        const sessionBody = await sessionResponse.json().catch(() => ({ educator: null }));
        if (cancelled) {
          return;
        }
        if (!sessionBody.educator) {
          setStatus("unauthenticated");
          return;
        }
        const [rosterResponse, evaluationsResponse, matchesResponse] = await Promise.all([
          fetch("/api/roster"),
          fetch(`/api/player-evaluations?playerId=${encodeURIComponent(playerId)}`),
          fetch("/api/matches"),
        ]);
        const rosterBody = await rosterResponse.json().catch(() => ({ players: [] }));
        const evaluationsBody = await evaluationsResponse.json().catch(() => ({ evaluations: [] }));
        const matchesBody = await matchesResponse.json().catch(() => ({ matches: [] }));
        if (cancelled) {
          return;
        }
        const found: Player | undefined = (rosterBody.players ?? []).find((candidate: Player) => candidate.id === playerId);
        if (!found) {
          setStatus("not-found");
          return;
        }
        setPlayer(found);
        setSeason(playerSeasonTotals(matchesBody.matches ?? [], playerId));
        const loadedEvaluations: Evaluation[] = evaluationsResponse.ok ? (evaluationsBody.evaluations ?? []) : [];
        setEvaluations(loadedEvaluations);
        setComparedEvaluationIds(defaultComparedEvaluationIds(loadedEvaluations));
        setStatus("ready");
      } catch {
        if (!cancelled) {
          setStatus("not-found");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [playerId]);

  function startEditing() {
    if (!player) {
      return;
    }
    setForm({
      firstName: player.firstName,
      lastName: player.lastName,
      birthDate: player.birthDate ?? "",
      phone: player.phone ?? "",
      email: player.email ?? "",
      position: player.position ?? "",
      jerseyNumber: player.jerseyNumber ?? "",
      preferredFoot: player.preferredFoot ?? "",
      strengths: player.strengths ?? "",
      workAreas: player.workAreas ?? "",
    });
    setDetailsError("");
    setEditing(true);
  }

  async function patchPlayer(patch: Record<string, string | null>): Promise<boolean> {
    const response = await fetch(`/api/roster/${playerId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setDetailsError(typeof body.error === "string" ? body.error : "L’enregistrement a échoué.");
      return false;
    }
    setPlayer(body.player);
    return true;
  }

  async function saveDetails(event: FormEvent) {
    event.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setDetailsError("Le prénom et le nom ne peuvent pas être vides.");
      return;
    }
    setSavingDetails(true);
    setDetailsError("");
    const ok = await patchPlayer({
      firstName: form.firstName,
      lastName: form.lastName,
      birthDate: form.birthDate || null,
      phone: form.phone || null,
      email: form.email || null,
      position: form.position || null,
      jerseyNumber: form.jerseyNumber || null,
      preferredFoot: form.preferredFoot || null,
      strengths: form.strengths || null,
      workAreas: form.workAreas || null,
    });
    setSavingDetails(false);
    if (ok) {
      setEditing(false);
    }
  }

  async function onPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setPhotoBusy(true);
    setDetailsError("");
    try {
      const dataUrl = await resizeImageToDataUrl(file, playerPhotoMaxSide);
      const cutout = await cutoutPhoto(dataUrl);
      if (cutout) {
        setPhotoChoice({ original: dataUrl, cutout });
      } else {
        await patchPlayer({ photo: dataUrl });
      }
    } catch {
      setDetailsError("Impossible de traiter cette image.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    await patchPlayer({ photo: null });
    setPhotoBusy(false);
  }

  function startEditingEvaluation(evaluation: Evaluation) {
    setEditingEvaluationId(evaluation.id);
    setNewScores(evaluation.scores);
    setNewDate(evaluation.createdAt.slice(0, 10));
    setEvaluationError("");
  }

  function cancelEditingEvaluation() {
    setEditingEvaluationId(null);
    setNewScores(midpointScores());
    setNewDate(new Date().toISOString().slice(0, 10));
    setEvaluationError("");
  }

  function toggleCompare(evaluationId: string) {
    setComparedEvaluationIds((current) => {
      const next = new Set(current);
      if (next.has(evaluationId)) {
        next.delete(evaluationId);
      } else {
        next.add(evaluationId);
      }
      return next;
    });
  }

  async function saveEvaluation(event: FormEvent) {
    event.preventDefault();
    setAddingEvaluation(true);
    setEvaluationError("");
    try {
      const editingId = editingEvaluationId;
      const response = editingId
        ? await fetch(`/api/player-evaluations/${editingId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ scores: newScores, date: new Date(newDate).toISOString() }),
          })
        : await fetch("/api/player-evaluations", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ playerId, scores: newScores, date: new Date(newDate).toISOString() }),
          });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setEvaluationError(typeof body.error === "string" ? body.error : "L’enregistrement a échoué.");
        return;
      }
      setEvaluations((current) => {
        const next = editingId ? current.filter((evaluation) => evaluation.id !== editingId) : current;
        // Toujours re-triée par date décroissante : modifier la date d'une évaluation peut
        // changer sa place dans l'historique, pas seulement sa note.
        return [...next, body.evaluation].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      });
      cancelEditingEvaluation();
    } catch {
      setEvaluationError("L’enregistrement a échoué, réessaie.");
    } finally {
      setAddingEvaluation(false);
    }
  }

  async function inviteTutor() {
    if (!player) {
      return;
    }
    setInvitingTutor(true);
    setInviteError("");
    setInviteCopied(false);
    try {
      const response = await fetch("/api/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId: player.id }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setInviteError(typeof body.error === "string" ? body.error : "La génération du lien a échoué.");
        return;
      }
      setInviteUrl(body.url);
    } catch {
      setInviteError("La génération du lien a échoué, réessaie.");
    } finally {
      setInvitingTutor(false);
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setInviteCopied(true);
    } catch {
      // Le champ reste sélectionnable manuellement.
    }
  }

  async function removeEvaluation(evaluationId: string) {
    setEvaluations((current) => current.filter((evaluation) => evaluation.id !== evaluationId));
    setComparedEvaluationIds((current) => {
      if (!current.has(evaluationId)) {
        return current;
      }
      const next = new Set(current);
      next.delete(evaluationId);
      return next;
    });
    if (editingEvaluationId === evaluationId) {
      cancelEditingEvaluation();
    }
    try {
      await fetch(`/api/player-evaluations/${evaluationId}`, { method: "DELETE" });
    } catch {
      // La liste reflète déjà l'intention ; rien de critique si la suppression réseau échoue.
    }
  }

  const latest = evaluations[0];
  const coachEvaluations = evaluations.filter((evaluation) => evaluation.source !== "player");
  // La limite d'historique est par saison : les évaluations des saisons passées ne comptent plus.
  const currentSeasonStart = seasonStartDate(new Date()).getTime();
  const currentSeasonCount = coachEvaluations.filter((evaluation) => new Date(evaluation.createdAt).getTime() >= currentSeasonStart).length;
  const evaluationSeasons = buildPlayerEvaluationSeasons(evaluations);

  return (
    <main className="player-shell">
      <header className="page-header player-header">
        <div>
          <span className="eyebrow light">Fiche joueur</span>
          <h1 title={player?.name ?? "Joueur"}>{player?.name ?? "Joueur"}</h1>
          <p title="Profil, coordonnées et suivi de progression.">Profil, coordonnées et suivi de progression.</p>
        </div>
        <div className="player-header-actions">
          <Link className="player-back" href="/equipe">
            ← Effectif
          </Link>
          {status === "ready" && <PrintButton label="Exporter le bilan en PDF" />}
        </div>
      </header>

      <section className="player-content">
        {status === "loading" && <p className="player-note">Chargement…</p>}
        {status === "unauthenticated" && (
          <p className="player-note">
            <Link href="/connexion">Connecte-toi</Link> pour voir cette fiche.
          </p>
        )}
        {status === "not-found" && (
          <p className="player-note">
            Joueur introuvable. <Link href="/equipe">Retour à l’effectif</Link>
          </p>
        )}

        {status === "ready" && player && (
          <>
            <div className="player-hero" data-number={player.jerseyNumber ?? ""}>
              <div className="player-card-column">
                <PlayerCard
                  jerseyNumber={player.jerseyNumber}
                  name={player.name}
                  photo={player.photo}
                  position={player.position}
                  preferredFoot={player.preferredFoot}
                  previousScores={coachEvaluations[1]?.scores ?? null}
                  scores={coachEvaluations[0]?.scores ?? null}
                  season={season}
                />
                <div className="player-photo-actions">
                  <button disabled={photoBusy} onClick={() => fileInputRef.current?.click()} type="button">
                    {photoBusy ? "Détourage…" : player.photo ? "Changer la photo" : "Ajouter une photo"}
                  </button>
                  {player.photo && (
                    <button disabled={photoBusy} onClick={removePhoto} type="button">
                      Retirer
                    </button>
                  )}
                  <input accept="image/*" className="visually-hidden" onChange={onPhotoChange} ref={fileInputRef} type="file" />
                </div>
                {photoChoice && (
                  <PhotoChoice
                    cutout={photoChoice.cutout}
                    onCancel={() => setPhotoChoice(null)}
                    onChoose={(photo) => {
                      setPhotoChoice(null);
                      void patchPlayer({ photo });
                    }}
                    original={photoChoice.original}
                  />
                )}
              </div>

              <div className="player-identity-body">
                <div className="player-block-head">
                  <h2>Profil et coordonnées</h2>
                  {!editing && (
                    <button className="player-edit" onClick={startEditing} type="button">
                      Modifier
                    </button>
                  )}
                </div>

                {editing ? (
                  <form className="player-form" onSubmit={saveDetails}>
                    <label>
                      <span>Prénom</span>
                      <input onChange={(event) => setForm({ ...form, firstName: event.target.value })} value={form.firstName} />
                    </label>
                    <label>
                      <span>Nom</span>
                      <input onChange={(event) => setForm({ ...form, lastName: event.target.value })} value={form.lastName} />
                    </label>
                    <label>
                      <span>Date de naissance</span>
                      <input onChange={(event) => setForm({ ...form, birthDate: event.target.value })} type="date" value={form.birthDate} />
                    </label>
                    <label>
                      <span>Téléphone (optionnel)</span>
                      <input onChange={(event) => setForm({ ...form, phone: event.target.value })} type="tel" value={form.phone} />
                    </label>
                    <label>
                      <span>E-mail (optionnel)</span>
                      <input onChange={(event) => setForm({ ...form, email: event.target.value })} type="email" value={form.email} />
                    </label>
                    <label>
                      <span>Poste</span>
                      <select onChange={(event) => setForm({ ...form, position: event.target.value })} value={form.position}>
                        <option value="">Non renseigné</option>
                        {playerPositions.map((position) => (
                          <option key={position}>{position}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Numéro</span>
                      <input
                        inputMode="numeric"
                        maxLength={2}
                        onChange={(event) => setForm({ ...form, jerseyNumber: event.target.value })}
                        value={form.jerseyNumber}
                      />
                    </label>
                    <label>
                      <span>Pied fort</span>
                      <select onChange={(event) => setForm({ ...form, preferredFoot: event.target.value })} value={form.preferredFoot}>
                        <option value="">Non renseigné</option>
                        {playerFeet.map((foot) => (
                          <option key={foot}>{foot}</option>
                        ))}
                      </select>
                    </label>
                    <label className="player-wide">
                      <span>Points forts</span>
                      <textarea maxLength={1000} onChange={(event) => setForm({ ...form, strengths: event.target.value })} rows={3} value={form.strengths} />
                    </label>
                    <label className="player-wide">
                      <span>Axes de travail</span>
                      <textarea maxLength={1000} onChange={(event) => setForm({ ...form, workAreas: event.target.value })} rows={3} value={form.workAreas} />
                    </label>
                    {detailsError && (
                      <p className="player-error" role="alert">
                        {detailsError}
                      </p>
                    )}
                    <div className="player-form-actions">
                      <button className="player-primary" disabled={savingDetails} type="submit">
                        Enregistrer
                      </button>
                      <button className="player-ghost" onClick={() => setEditing(false)} type="button">
                        Annuler
                      </button>
                    </div>
                  </form>
                ) : (
                  <dl className="player-grid">
                    <div>
                      <dt>Poste</dt>
                      <dd>{player.position ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Numéro</dt>
                      <dd>{player.jerseyNumber ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Pied fort</dt>
                      <dd>{player.preferredFoot ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Date de naissance</dt>
                      <dd>{formatBirthDate(player.birthDate)}</dd>
                    </div>
                    <div>
                      <dt>Téléphone</dt>
                      <dd>{player.phone ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>E-mail</dt>
                      <dd>{player.email ?? "—"}</dd>
                    </div>
                    <div className="player-wide">
                      <dt>Points forts</dt>
                      <dd>{player.strengths ?? "—"}</dd>
                    </div>
                    <div className="player-wide">
                      <dt>Axes de travail</dt>
                      <dd>{player.workAreas ?? "—"}</dd>
                    </div>
                  </dl>
                )}
                {detailsError && !editing && (
                  <p className="player-error" role="alert">
                    {detailsError}
                  </p>
                )}
              </div>
            </div>

            <div className="player-block">
              <div className="player-block-head">
                <h2>Évaluation</h2>
                <span className="player-count">
                  {currentSeasonCount}/{playerEvaluationMaxPerSeason} cette saison
                </span>
              </div>

              <div className="player-evaluation-layout">
                <div className="player-evaluation-radar player-evaluation-radar-big">
                  <RadarChart
                    axes={radarAxes}
                    max={playerEvaluationMaxScore}
                    min={playerEvaluationMinScore}
                    size={340}
                    series={
                      comparedEvaluationIds.size > 0
                        ? evaluations
                            .filter((evaluation) => comparedEvaluationIds.has(evaluation.id))
                            .map((evaluation) => ({
                              key: evaluation.id,
                              label: evaluationLabel(evaluation, formatDate(evaluation.createdAt)),
                              color: colorForEvaluation(evaluation.id, evaluations),
                              scores: evaluation.scores,
                            }))
                        : undefined
                    }
                    scores={comparedEvaluationIds.size === 0 ? (latest ? latest.scores : newScores) : undefined}
                  />
                  {comparedEvaluationIds.size === 0 && (
                    <p className="player-radar-caption">
                      {latest ? evaluationLabel(latest, formatDate(latest.createdAt)) : "Aperçu de la note en cours de saisie"}
                    </p>
                  )}
                </div>

                <div className="player-evaluation-columns">
                  <div className="print-hidden">
                    <h3>{editingEvaluationId ? "Modifier l’évaluation" : "Nouvelle évaluation"}</h3>
                    <form className="player-evaluation-form" onSubmit={saveEvaluation}>
                      <label className="player-evaluation-date">
                        <span>Date</span>
                        <input onChange={(event) => setNewDate(event.target.value)} required type="date" value={newDate} />
                      </label>
                      {playerEvaluationAspects.map((aspect) => (
                        <div className="player-evaluation-row" key={aspect}>
                          <span>{playerEvaluationAspectLabels[aspect]}</span>
                          <input
                            aria-label={playerEvaluationAspectLabels[aspect]}
                            max={playerEvaluationMaxScore}
                            min={playerEvaluationMinScore}
                            onChange={(event) => setNewScores((current) => ({ ...current, [aspect]: Number(event.target.value) }))}
                            type="range"
                            value={newScores[aspect]}
                          />
                          <strong>{newScores[aspect]}</strong>
                        </div>
                      ))}
                      {evaluationError && (
                        <p className="player-error" role="alert">
                          {evaluationError}
                        </p>
                      )}
                      <div className="player-evaluation-form-actions">
                        <button className="player-primary" disabled={addingEvaluation} type="submit">
                          {addingEvaluation ? "Enregistrement…" : editingEvaluationId ? "Enregistrer les modifications" : "Enregistrer cette évaluation"}
                        </button>
                        {editingEvaluationId && (
                          <button onClick={cancelEditingEvaluation} type="button">
                            Annuler
                          </button>
                        )}
                      </div>
                    </form>
                  </div>

                  <div>
                    <h3>Historique</h3>
                    {evaluations.length === 0 ? (
                      <p className="player-evaluation-empty">Aucune évaluation pour l’instant.</p>
                    ) : (
                      <ul className="player-evaluation-history">
                        {evaluations.map((evaluation) => {
                          const total = playerEvaluationAspects.reduce((sum, aspect) => sum + evaluation.scores[aspect], 0);
                          const average = Math.round((total / playerEvaluationAspects.length) * 10) / 10;
                          const compared = comparedEvaluationIds.has(evaluation.id);
                          return (
                            <li key={evaluation.id}>
                              <label className="player-evaluation-compare">
                                <input checked={compared} onChange={() => toggleCompare(evaluation.id)} type="checkbox" />
                                <span
                                  aria-hidden="true"
                                  className="radar-chart-legend-dot"
                                  style={{ background: compared ? colorForEvaluation(evaluation.id, evaluations) : "transparent" }}
                                />
                              </label>
                              <div>
                                <strong>
                                  {evaluation.source === "player" ? "Auto-évaluation · " : ""}
                                  {formatDate(evaluation.createdAt)}
                                </strong>
                                <span>
                                  Moyenne {average}/{playerEvaluationMaxScore}
                                </span>
                              </div>
                              <div className="player-evaluation-history-actions">
                                {evaluation.source !== "player" && (
                                  <button onClick={() => startEditingEvaluation(evaluation)} type="button">
                                    Modifier
                                  </button>
                                )}
                                <button
                                  aria-label={`Retirer l’évaluation du ${formatDate(evaluation.createdAt)}`}
                                  onClick={() => removeEvaluation(evaluation.id)}
                                  type="button"
                                >
                                  Retirer
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {evaluationSeasons.length > 0 && (
              <div className="player-block">
                <div className="player-block-head">
                  <h2>Progression par saison</h2>
                </div>
                <p className="player-invite-lead">Moyenne des évaluations de l’éducateur, aspect par aspect, de la plus récente à la plus ancienne saison.</p>
                <EvaluationSeasonsTable seasons={evaluationSeasons} />
              </div>
            )}

            <div className="player-block print-hidden">
              <div className="player-block-head">
                <h2>Messages</h2>
              </div>
              <p className="player-invite-lead">Discussion avec {player.name} ou son tuteur.</p>
              <MessagingThread fetchUrl={`/api/roster/${playerId}/messages`} sendUrl={`/api/roster/${playerId}/messages`} viewerRole="coach" />
            </div>

            <div className="player-block print-hidden">
              <div className="player-block-head">
                <h2>Accès tuteur / joueur</h2>
              </div>
              <p className="player-invite-lead">
                Génère un lien à transmettre au tuteur : il crée un compte séparé qui ne voit que le suivi de {player.name} (évaluations, présences, calendrier,
                convocations).
              </p>
              {inviteUrl && (
                <div className="player-invite-result">
                  <input aria-label="Lien d’invitation" readOnly value={inviteUrl} />
                  <button className="player-ghost" onClick={copyInvite} type="button">
                    {inviteCopied ? "Copié" : "Copier"}
                  </button>
                </div>
              )}
              {/* Un nouveau lien à chaque fois (deuxième parent, lien perdu) : les précédents restent valables. */}
              <button className={inviteUrl ? "player-ghost" : "player-primary"} disabled={invitingTutor} onClick={inviteTutor} type="button">
                {invitingTutor ? "…" : inviteUrl ? "Générer un autre lien" : "Générer un lien d’invitation"}
              </button>
              {inviteError && (
                <p className="player-error" role="alert">
                  {inviteError}
                </p>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
