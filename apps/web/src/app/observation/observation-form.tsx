"use client";

import {
  canCompleteObservation,
  completeObservation,
  createObservationDraft,
  diagnosticCriteria,
  rateObservation,
  setObservationNote,
  togglePlayerSignal,
  type ObservationDraft,
  type ObservationEventType,
  type ObservationLevel,
  type ObservationReport,
  type PlayerReference,
} from "@evolyfoot/domain";
import { useState } from "react";

const demoPlayers: ReadonlyArray<PlayerReference> = [
  { id: "lina-dupont", name: "Lina" },
  { id: "noah-martin", name: "Noah" },
  { id: "sami-bernard", name: "Sami" },
];

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

function eventTitle(type: ObservationEventType) {
  return type === "match" ? "Observation de match" : "Observation de séance";
}

function createDraft(type: ObservationEventType) {
  return createObservationDraft(type, eventTitle(type), demoPlayers);
}

interface ObservationFormProps {
  initialEventType: ObservationEventType;
}

export function ObservationForm({ initialEventType }: ObservationFormProps) {
  const [draft, setDraft] = useState<ObservationDraft>(() => createDraft(initialEventType));
  const [report, setReport] = useState<ObservationReport>();
  const complete = canCompleteObservation(draft);
  const remaining = diagnosticCriteria.length - draft.ratings.length;

  function editDraft(nextDraft: ObservationDraft) {
    setDraft(nextDraft);
    setReport(undefined);
  }

  function selectEventType(eventType: ObservationEventType) {
    editDraft(createDraft(eventType));
  }

  return (
    <section className="observation-form" aria-labelledby="observation-form-title">
      <div className="observation-form-intro">
        <div><span className="eyebrow">EN MOINS DE TROIS MINUTES</span><h2 id="observation-form-title">Une lecture utile du terrain</h2></div>
        <p>Les quatre comportements donnent une tendance collective. Les joueurs restent facultatifs.</p>
      </div>

      <fieldset className="event-choice">
        <legend>Quel moment observes-tu&nbsp;?</legend>
        <div>{eventOptions.map((option) => <button aria-pressed={draft.eventType === option.type} className={draft.eventType === option.type ? "active" : ""} key={option.type} onClick={() => selectEventType(option.type)} type="button">{option.label}</button>)}</div>
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
                  {levels.map((level) => <button aria-label={`${criterion.label} : ${level.label}`} aria-pressed={selectedLevel === level.value} className={selectedLevel === level.value ? "active" : ""} key={level.value} onClick={() => editDraft(rateObservation(draft, criterion.id, level.value))} type="button">{level.label}</button>)}
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
                <button aria-label={`Mettre ${player.name} en réussite à retenir`} aria-pressed={signal === "highlight"} className={signal === "highlight" ? "active highlight" : ""} onClick={() => editDraft(togglePlayerSignal(draft, player, "highlight"))} type="button">Réussite à retenir</button>
                <button aria-label={`Signaler ${player.name} pour un accompagnement`} aria-pressed={signal === "support"} className={signal === "support" ? "active support" : ""} onClick={() => editDraft(togglePlayerSignal(draft, player, "support"))} type="button">À accompagner</button>
              </div></article>;
            })}
          </div>
          <label className="observation-note"><span>Une note si elle aide à te souvenir</span><textarea maxLength={280} onChange={(event) => editDraft(setObservationNote(draft, event.target.value))} placeholder="Un fait marquant, une situation à revoir…" rows={4} value={draft.note ?? ""} /><small>{`${draft.note?.length ?? 0}/280 caractères`}</small></label>
        </aside>
      </div>

      <div className="observation-submit">
        <button disabled={!complete} onClick={() => complete && setReport(completeObservation(draft))} type="button">Valider l’observation <span aria-hidden="true">→</span></button>
        {!complete && <p>{`${remaining} comportement${remaining > 1 ? "s" : ""} reste${remaining > 1 ? "nt" : ""} à renseigner.`}</p>}
      </div>

      {report && <section aria-live="polite" className="observation-result" role="status"><span className="eyebrow">SYNTHÈSE EVOLY</span><h3>{`Tendance ${levelText[report.summary.trend]}`}</h3><dl><div><dt>Point fort</dt><dd>{report.summary.strongest.label}</dd></div><div><dt>Priorité à renforcer</dt><dd>{report.summary.weakest.label}</dd></div><div><dt>Joueurs signalés</dt><dd>{`${report.signals.length} joueur${report.signals.length > 1 ? "s" : ""} signalé${report.signals.length > 1 ? "s" : ""}`}</dd></div></dl></section>}
    </section>
  );
}
