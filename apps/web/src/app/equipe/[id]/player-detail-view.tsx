"use client";

import {
  playerEvaluationAspectLabels,
  playerEvaluationAspects,
  playerEvaluationMaxPerSeason,
  playerEvaluationMaxScore,
  playerEvaluationMinScore,
  type PlayerEvaluationScores,
} from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { RadarChart } from "../../charts";

interface Player {
  id: string;
  name: string;
  photo: string | null;
  birthDate: string | null;
  phone: string | null;
  email: string | null;
}

interface Evaluation {
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
  return Number.isNaN(parsed.getTime())
    ? iso
    : parsed.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function formatBirthDate(value: string | null): string {
  if (!value) {
    return "—";
  }
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

// Redimensionne l'image choisie à 320px de côté max et la renvoie en data URL JPEG compacte --
// le stockage se fait tel quel en base (pas de service d'objets), inutile d'y mettre l'original.
function resizeToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("lecture impossible"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("image invalide"));
      image.onload = () => {
        const maxSide = 320;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("canvas indisponible"));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

type DetailForm = { name: string; birthDate: string; phone: string; email: string };

export function PlayerDetailView({ playerId }: { playerId: string }) {
  const [status, setStatus] = useState<"loading" | "ready" | "not-found" | "unauthenticated">("loading");
  const [player, setPlayer] = useState<Player | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<DetailForm>({ name: "", birthDate: "", phone: "", email: "" });
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  const [newScores, setNewScores] = useState<PlayerEvaluationScores>(midpointScores);
  const [addingEvaluation, setAddingEvaluation] = useState(false);
  const [evaluationError, setEvaluationError] = useState("");

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
        const [rosterResponse, evaluationsResponse] = await Promise.all([
          fetch("/api/roster"),
          fetch(`/api/player-evaluations?playerId=${encodeURIComponent(playerId)}`),
        ]);
        const rosterBody = await rosterResponse.json().catch(() => ({ players: [] }));
        const evaluationsBody = await evaluationsResponse.json().catch(() => ({ evaluations: [] }));
        if (cancelled) {
          return;
        }
        const found: Player | undefined = (rosterBody.players ?? []).find((candidate: Player) => candidate.id === playerId);
        if (!found) {
          setStatus("not-found");
          return;
        }
        setPlayer(found);
        setEvaluations(evaluationsResponse.ok ? (evaluationsBody.evaluations ?? []) : []);
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
      name: player.name,
      birthDate: player.birthDate ?? "",
      phone: player.phone ?? "",
      email: player.email ?? "",
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
    if (!form.name.trim()) {
      setDetailsError("Le prénom ne peut pas être vide.");
      return;
    }
    setSavingDetails(true);
    setDetailsError("");
    const ok = await patchPlayer({
      name: form.name,
      birthDate: form.birthDate || null,
      phone: form.phone || null,
      email: form.email || null,
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
      const dataUrl = await resizeToDataUrl(file);
      await patchPlayer({ photo: dataUrl });
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

  async function addEvaluation(event: FormEvent) {
    event.preventDefault();
    setAddingEvaluation(true);
    setEvaluationError("");
    try {
      const response = await fetch("/api/player-evaluations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId, scores: newScores }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setEvaluationError(typeof body.error === "string" ? body.error : "L’enregistrement a échoué.");
        return;
      }
      setEvaluations((current) => [body.evaluation, ...current]);
      setNewScores(midpointScores());
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
    try {
      await fetch(`/api/player-evaluations/${evaluationId}`, { method: "DELETE" });
    } catch {
      // La liste reflète déjà l'intention ; rien de critique si la suppression réseau échoue.
    }
  }

  const latest = evaluations[0];

  return (
    <main className="player-shell">
      <header className="page-header player-header">
        <Link className="onboarding-brand" href="/app">
          <span className="brand-mark">E</span> EvolyFoot
        </Link>
        <div>
          <span className="eyebrow light">Fiche joueur</span>
          <h1 title={player?.name ?? "Joueur"}>{player?.name ?? "Joueur"}</h1>
          <p title="Coordonnées et suivi de progression.">Coordonnées et suivi de progression.</p>
        </div>
        <Link className="player-back" href="/equipe">
          ← Effectif
        </Link>
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
            <div className="player-block player-identity">
              <div className="player-photo">
                {player.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={`Photo de ${player.name}`} src={player.photo} />
                ) : (
                  <span aria-hidden="true">
                    {player.name.trim().slice(0, 1).toUpperCase() || "?"}
                  </span>
                )}
                <div className="player-photo-actions">
                  <button disabled={photoBusy} onClick={() => fileInputRef.current?.click()} type="button">
                    {photoBusy ? "…" : player.photo ? "Changer la photo" : "Ajouter une photo"}
                  </button>
                  {player.photo && (
                    <button disabled={photoBusy} onClick={removePhoto} type="button">
                      Retirer
                    </button>
                  )}
                  <input
                    accept="image/*"
                    className="visually-hidden"
                    onChange={onPhotoChange}
                    ref={fileInputRef}
                    type="file"
                  />
                </div>
              </div>

              <div className="player-identity-body">
                <div className="player-block-head">
                  <h2>Coordonnées</h2>
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
                      <input onChange={(event) => setForm({ ...form, name: event.target.value })} value={form.name} />
                    </label>
                    <label>
                      <span>Date de naissance</span>
                      <input
                        onChange={(event) => setForm({ ...form, birthDate: event.target.value })}
                        type="date"
                        value={form.birthDate}
                      />
                    </label>
                    <label>
                      <span>Téléphone (optionnel)</span>
                      <input
                        onChange={(event) => setForm({ ...form, phone: event.target.value })}
                        type="tel"
                        value={form.phone}
                      />
                    </label>
                    <label>
                      <span>E-mail (optionnel)</span>
                      <input
                        onChange={(event) => setForm({ ...form, email: event.target.value })}
                        type="email"
                        value={form.email}
                      />
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
                  {evaluations.length}/{playerEvaluationMaxPerSeason}
                </span>
              </div>

              <div className="player-evaluation">
                <form className="player-evaluation-form" onSubmit={addEvaluation}>
                  {playerEvaluationAspects.map((aspect) => (
                    <div className="player-evaluation-row" key={aspect}>
                      <span>{playerEvaluationAspectLabels[aspect]}</span>
                      <input
                        aria-label={playerEvaluationAspectLabels[aspect]}
                        max={playerEvaluationMaxScore}
                        min={playerEvaluationMinScore}
                        onChange={(event) =>
                          setNewScores((current) => ({ ...current, [aspect]: Number(event.target.value) }))
                        }
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
                  <button className="player-primary" disabled={addingEvaluation} type="submit">
                    {addingEvaluation ? "Enregistrement…" : "Enregistrer cette évaluation"}
                  </button>
                </form>

                <div className="player-evaluation-radar">
                  <RadarChart
                    axes={radarAxes}
                    max={playerEvaluationMaxScore}
                    min={playerEvaluationMinScore}
                    scores={latest ? latest.scores : newScores}
                  />
                  <p className="player-radar-caption">
                    {latest ? `Dernière évaluation · ${formatDate(latest.createdAt)}` : "Aperçu de la note en cours de saisie"}
                  </p>
                </div>
              </div>

              {evaluations.length > 0 && (
                <ul className="player-evaluation-history">
                  {evaluations.map((evaluation) => {
                    const total = playerEvaluationAspects.reduce((sum, aspect) => sum + evaluation.scores[aspect], 0);
                    const average = Math.round((total / playerEvaluationAspects.length) * 10) / 10;
                    return (
                      <li key={evaluation.id}>
                        <div>
                          <strong>{formatDate(evaluation.createdAt)}</strong>
                          <span>Moyenne {average}/{playerEvaluationMaxScore}</span>
                        </div>
                        <button
                          aria-label={`Retirer l’évaluation du ${formatDate(evaluation.createdAt)}`}
                          onClick={() => removeEvaluation(evaluation.id)}
                          type="button"
                        >
                          Retirer
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="player-block">
              <div className="player-block-head">
                <h2>Accès tuteur / joueur</h2>
              </div>
              <p className="player-invite-lead">
                Génère un lien à transmettre au tuteur : il crée un compte séparé qui ne voit que le suivi de{" "}
                {player.name} (évaluations, présences, calendrier, convocations).
              </p>
              {inviteUrl ? (
                <div className="player-invite-result">
                  <input aria-label="Lien d’invitation" readOnly value={inviteUrl} />
                  <button className="player-ghost" onClick={copyInvite} type="button">
                    {inviteCopied ? "Copié" : "Copier"}
                  </button>
                </div>
              ) : (
                <button className="player-primary" disabled={invitingTutor} onClick={inviteTutor} type="button">
                  {invitingTutor ? "…" : "Générer un lien d’invitation"}
                </button>
              )}
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
