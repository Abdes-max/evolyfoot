"use client";

import {
  buildDevelopmentPlan,
  canCompleteObservation,
  completeObservation,
  createObservationDraft,
  diagnosticCriteria,
  rateObservation,
  setObservationNote,
  summarizeDiagnostic,
  suggestAdjustmentFromObservation,
  togglePlayerSignal,
  type AdjustmentSuggestion,
  type DevelopmentWeek,
  type DiagnosticScores,
  type ObservationDraft,
  type ObservationEventType,
  type ObservationLevel,
  type ObservationReport,
  type PlayerReference,
} from "@evolyfoot/domain";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AdjustmentCard } from "./adjustment-card";

// Joueurs de démonstration, utilisés tant qu'aucun effectif nominatif réel n'est disponible
// (visiteur anonyme, ou éducateur connecté n'ayant pas encore ajouté de joueur sur /equipe).
const demoPlayers: ReadonlyArray<PlayerReference> = [
  { id: "lina-dupont", name: "Lina" },
  { id: "noah-martin", name: "Noah" },
  { id: "sami-bernard", name: "Sami" },
];

// Diagnostic de démonstration, utilisé tant qu'aucun diagnostic réel n'est disponible, pour
// dériver la semaine en cours de la même façon que /plan et /session.
const demoScores: DiagnosticScores = { availability: 3, scanning: 2, progression: 4, reactionAfterLoss: 1 };

const eventOptions: ReadonlyArray<{ type: ObservationEventType; label: string }> = [
  { type: "training", label: "Après une séance" },
  { type: "match", label: "Après un match" },
];

const levels: ReadonlyArray<{ value: ObservationLevel; label: string }> = [
  { value: "reinforce", label: "À renforcer" },
  { value: "progress", label: "En progrès" },
  { value: "achieved", label: "Acquis aujourd’hui" },
];

const levelText: Record<ObservationLevel, string> = {
  reinforce: "à renforcer",
  progress: "en progrès",
  achieved: "acquise aujourd’hui",
};

const demoWeek: DevelopmentWeek = buildDevelopmentPlan(summarizeDiagnostic(demoScores)).weeks[0];

function eventTitle(type: ObservationEventType) {
  return type === "match" ? "Observation de match" : "Observation de séance";
}

function createDraft(type: ObservationEventType, players: ReadonlyArray<PlayerReference>) {
  return createObservationDraft(type, eventTitle(type), players);
}

type SaveState = "idle" | "pending" | "success" | "error" | "auth-required";

interface ObservationFormProps {
  initialEventType: ObservationEventType;
}

export function ObservationForm({ initialEventType }: ObservationFormProps) {
  const [players, setPlayers] = useState<ReadonlyArray<PlayerReference>>(demoPlayers);
  const [draft, setDraft] = useState<ObservationDraft>(() => createDraft(initialEventType, demoPlayers));
  const [report, setReport] = useState<ObservationReport>();
  const [suggestion, setSuggestion] = useState<AdjustmentSuggestion>();
  const [currentWeek, setCurrentWeek] = useState<DevelopmentWeek>(demoWeek);
  const [authenticated, setAuthenticated] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const complete = canCompleteObservation(draft);
  const remaining = diagnosticCriteria.length - draft.ratings.length;

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

        if (isAuthenticated) {
          const [diagnosticResponse, rosterResponse] = await Promise.all([
            fetch("/api/diagnostic"),
            fetch("/api/roster"),
          ]);
          const diagnosticBody = await diagnosticResponse.json().catch(() => ({ scores: null }));
          const rosterBody = await rosterResponse.json().catch(() => ({ players: [] }));
          if (cancelled) {
            return;
          }
          if (diagnosticBody.scores) {
            setCurrentWeek(buildDevelopmentPlan(summarizeDiagnostic(diagnosticBody.scores)).weeks[0]);
          }
          const roster: ReadonlyArray<PlayerReference> = rosterBody.players ?? [];
          if (roster.length > 0) {
            setPlayers(roster);
            // Reconstruit le brouillon avec l'effectif réel -- sans effet côté utilisateur puisque
            // ce chargement se termine avant toute interaction possible avec le formulaire.
            setDraft((current) => createDraft(current.eventType, roster));
          }
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

  function editDraft(nextDraft: ObservationDraft) {
    setDraft(nextDraft);
    setReport(undefined);
    setSuggestion(undefined);
    setSaveState("idle");
  }

  async function submitObservation() {
    if (!complete) return;
    const nextReport = completeObservation(draft);
    setReport(nextReport);
    setSuggestion(suggestAdjustmentFromObservation(nextReport, currentWeek));

    if (!authenticated) {
      setSaveState("auth-required");
      return;
    }

    setSaveState("pending");
    try {
      const response = await fetch("/api/observations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      setSaveState(response.ok ? "success" : "error");
    } catch {
      setSaveState("error");
    }
  }

  function selectEventType(eventType: ObservationEventType) {
    editDraft(createDraft(eventType, players));
  }

  return (
    <section className="observation-form" aria-labelledby="observation-form-title">
      <div className="observation-form-intro">
        <div><span className="eyebrow">EN MOINS DE TROIS MINUTES</span><h2 id="observation-form-title">Une lecture utile du terrain</h2></div>
        <p>Les quatre comportements donnent une tendance collective. Les joueurs restent facultatifs.</p>
      </div>

      <fieldset className="event-choice">
        <legend>Quel moment observes-tu&nbsp;?</legend>
        <div>{eventOptions.map((option) => {
          const selected = draft.eventType === option.type;
          return <button aria-label={option.label} aria-pressed={selected} className={selected ? "active" : ""} key={option.type} onClick={() => selectEventType(option.type)} type="button">{option.label}{selected && <span aria-hidden="true" className="selection-indicator"> · Sélectionné</span>}</button>;
        })}</div>
      </fieldset>

      <div className="observation-grid">
        <section aria-labelledby="collective-observation-title">
          <div className="section-title"><span className="eyebrow">COLLECTIF</span><h3 id="collective-observation-title">Les comportements du groupe</h3></div>
          <div className="observation-criteria">
            {diagnosticCriteria.map((criterion) => {
              const selectedLevel = draft.ratings.find((rating) => rating.criterion === criterion.id)?.level;
              return <article className="observation-criterion" key={criterion.id}>
                <div><h4>{criterion.label}</h4><p>{criterion.description}</p></div>
                <div aria-label={criterion.label} className="observation-levels">
                  {levels.map((level) => {
                    const selected = selectedLevel === level.value;
                    return <button aria-label={`${criterion.label} : ${level.label}`} aria-pressed={selected} className={selected ? "active" : ""} key={level.value} onClick={() => editDraft(rateObservation(draft, criterion.id, level.value))} type="button">{level.label}{selected && <span aria-hidden="true" className="selection-indicator"> · Sélectionné</span>}</button>;
                  })}
                </div>
              </article>;
            })}
          </div>
        </section>

        <aside className="observation-aside" aria-labelledby="player-observation-title">
          <div className="section-title"><span className="eyebrow">FACULTATIF</span><h3 id="player-observation-title">Joueurs à retenir</h3><p>Un même joueur ne peut recevoir qu&apos;un seul signal.</p></div>
          <div className="player-signals">
            {draft.players.map((player) => {
              const signal = draft.signals.find((candidate) => candidate.playerId === player.id)?.kind;
              return <article key={player.id}><strong>{player.name}</strong><div>
                <button aria-label={`Mettre ${player.name} en réussite à retenir`} aria-pressed={signal === "highlight"} className={signal === "highlight" ? "active highlight" : ""} onClick={() => editDraft(togglePlayerSignal(draft, player, "highlight"))} type="button">Réussite à retenir{signal === "highlight" && <span aria-hidden="true" className="selection-indicator"> · Sélectionné</span>}</button>
                <button aria-label={`Signaler ${player.name} pour un accompagnement`} aria-pressed={signal === "support"} className={signal === "support" ? "active support" : ""} onClick={() => editDraft(togglePlayerSignal(draft, player, "support"))} type="button">À accompagner{signal === "support" && <span aria-hidden="true" className="selection-indicator"> · Sélectionné</span>}</button>
              </div></article>;
            })}
          </div>
          <label className="observation-note"><span>Une note si elle aide à te souvenir</span><textarea maxLength={280} onChange={(event) => editDraft(setObservationNote(draft, event.target.value))} placeholder="Un fait marquant, une situation à revoir…" rows={4} value={draft.note ?? ""} /><small>{`${draft.note?.length ?? 0}/280 caractères`}</small></label>
        </aside>
      </div>

      <div className="observation-submit">
        <button disabled={!complete} onClick={submitObservation} type="button">Valider l’observation <span aria-hidden="true">→</span></button>
        {!complete && <p>{`${remaining} comportement${remaining > 1 ? "s" : ""} reste${remaining > 1 ? "nt" : ""} à renseigner.`}</p>}
      </div>

      {report && <section aria-live="polite" className="observation-result" role="status"><span className="eyebrow">SYNTHÈSE EVOLY</span><h3>{`Tendance ${levelText[report.summary.trend]}`}</h3><dl><div><dt>Point fort</dt><dd>{report.summary.strongest.label}</dd></div><div><dt>Priorité à renforcer</dt><dd>{report.summary.weakest.label}</dd></div><div><dt>Joueurs signalés</dt><dd>{`${report.signals.length} joueur${report.signals.length > 1 ? "s" : ""} signalé${report.signals.length > 1 ? "s" : ""}`}</dd></div></dl>
        {saveState === "auth-required" && <p className="field-error">Connecte-toi pour enregistrer cette observation. <Link href="/connexion">Se connecter →</Link></p>}
        {saveState === "error" && <p className="field-error">La sauvegarde a échoué, réessaie.</p>}
      </section>}
      {suggestion && <AdjustmentCard suggestion={suggestion} />}
      {report && <Link className="observation-exit back-link" href="/">Retour au tableau de bord</Link>}
    </section>
  );
}
