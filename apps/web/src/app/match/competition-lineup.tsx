"use client";

import {
  addSubstitute,
  assignPlayerToSlot,
  changeCompetitionFormation,
  clearSlot,
  emptyCompetitionLineup,
  formationSlots,
  gameFormats,
  lineupFromTemplate,
  listFormations,
  maxSubstitutes,
  removeSubstitute,
  type CompetitionLineup,
  type GameFormat,
  type MatchPlan,
} from "@evolyfoot/domain";
import { useState } from "react";
import { initials, MatchPitch } from "./match-pitch";
import { PlayerPicker, type PickablePlayer } from "./player-picker";

// Les opérations de composition du domaine travaillent sur un MatchPlan : seuls les champs de la feuille comptent ici.
function asPlan(value: CompetitionLineup): MatchPlan {
  return {
    opponent: "",
    dateLabel: "",
    venue: "home",
    gameFormat: value.gameFormat,
    formationId: value.formationId,
    status: "scheduled",
    lineup: value.lineup,
    captainPlayerId: value.captainPlayerId,
    substitutePlayerIds: value.substitutePlayerIds,
  };
}

function fromPlan(value: CompetitionLineup, plan: MatchPlan): CompetitionLineup {
  return { ...value, lineup: [...plan.lineup], captainPlayerId: plan.captainPlayerId, substitutePlayerIds: [...plan.substitutePlayerIds] };
}

// Composition d'un tournoi ou d'un plateau, comme dans l'app Coach : format, formation, postes sur le
// terrain, capitaine et banc. Chaque changement est enregistré aussitôt.
export function CompetitionLineupEditor({
  lineupUrl,
  initial,
  defaultGameFormat,
  players,
  readOnly,
  maxBench,
  template,
  startLabel = "Préparer la composition",
}: {
  lineupUrl: string;
  initial: CompetitionLineup | null;
  defaultGameFormat: GameFormat;
  // Joueurs concernés (plus ceux déjà placés s'ils ont été décochés), avec poste et numéro.
  players: readonly (PickablePlayer & { photo?: string | null })[];
  readOnly?: boolean;
  // Remplaçants au plus (6 pour la compo type) ; par défaut, la limite du format de jeu.
  maxBench?: number;
  // Compo type de l'équipe : point de départ proposé quand la compo est vide.
  template?: CompetitionLineup | null;
  startLabel?: string;
}) {
  const [value, setValue] = useState<CompetitionLineup>(() => initial ?? emptyCompetitionLineup(defaultGameFormat));
  const [pickingBenchIndex, setPickingBenchIndex] = useState<number | null>(null);
  const [error, setError] = useState("");
  // Facultative : rien n'est affiché ni enregistré tant que le coach ne la prépare pas.
  const [started, setStarted] = useState(initial !== null);

  async function persist(next: CompetitionLineup) {
    setError("");
    setValue(next);
    try {
      const response = await fetch(lineupUrl, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ lineup: next }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(typeof body?.error === "string" ? body.error : "La composition n’a pas été enregistrée, réessaie.");
        return;
      }
      if (body?.lineup) setValue(body.lineup);
    } catch {
      setError("La composition n’a pas été enregistrée, réessaie.");
    }
  }

  const slots = formationSlots(value.gameFormat, value.formationId);
  const formations = listFormations(value.gameFormat);
  const benchMax = maxBench ?? maxSubstitutes(value.gameFormat);
  const bench: Array<string | null> = Array.from(
    { length: Math.max(benchMax, value.substitutePlayerIds.length) },
    (_, index) => value.substitutePlayerIds[index] ?? null,
  );
  const nameOf = (playerId: string) =>
    players.find((player) => player.id === playerId)?.name ?? value.lineup.find((assignment) => assignment.playerId === playerId)?.playerName ?? "";

  function assignSlot(slotId: string, playerId: string) {
    const player = players.find((candidate) => candidate.id === playerId);
    if (player) void persist(fromPlan(value, assignPlayerToSlot(asPlan(value), slotId, player)));
  }

  if (!started) {
    return readOnly ? (
      <p className="match-slot-hint">Pas de composition pour cette journée.</p>
    ) : (
      <div className="competition-lineup-start">
        {template && (
          <button
            className="match-convocation-send"
            onClick={() => {
              setStarted(true);
              void persist(lineupFromTemplate(template, new Set(players.map((player) => player.id))));
            }}
            type="button"
          >
            Partir de la compo type
          </button>
        )}
        <button className="match-details-save" onClick={() => setStarted(true)} type="button">
          {template ? "Compo vide" : startLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="competition-lineup">
      {!readOnly && (
        <div className="match-formation-picker" role="group" aria-label="Format de jeu">
          {gameFormats.map((format) => (
            <button
              aria-pressed={format === value.gameFormat}
              className={format === value.gameFormat ? "choice active" : "choice"}
              key={format}
              onClick={() => format !== value.gameFormat && void persist(changeCompetitionFormation(value, format, listFormations(format)[0]!.id, maxBench))}
              type="button"
            >
              Foot à {format}
            </button>
          ))}
        </div>
      )}
      {!readOnly && formations.length > 1 && (
        <div className="match-formation-picker" role="group" aria-label="Formation">
          {formations.map((formation) => (
            <button
              aria-pressed={formation.id === value.formationId}
              className={formation.id === value.formationId ? "choice active" : "choice"}
              key={formation.id}
              onClick={() => formation.id !== value.formationId && void persist(changeCompetitionFormation(value, value.gameFormat, formation.id, maxBench))}
              type="button"
            >
              {formation.label}
            </button>
          ))}
        </div>
      )}

      <MatchPitch
        captainPlayerId={value.captainPlayerId}
        lineup={value.lineup}
        onCaptainChange={readOnly ? undefined : (playerId) => void persist({ ...value, captainPlayerId: playerId })}
        onSlotAssign={readOnly ? undefined : assignSlot}
        onSlotClear={readOnly ? undefined : (slotId) => void persist(fromPlan(value, clearSlot(asPlan(value), slotId)))}
        roster={players}
        slots={slots}
        substitutePlayerIds={value.substitutePlayerIds}
      />
      {!readOnly && <p className="match-slot-hint">Touche un poste sur le terrain pour y affecter un joueur.</p>}

      <section className="match-bench">
        <h2>Remplaçants {readOnly ? "" : `(max. ${benchMax})`}</h2>
        <div aria-label="Remplaçants" className="match-bench-tokens" role="group">
          {bench.map((playerId, index) => {
            const label = playerId ? `Remplaçant : ${nameOf(playerId)}` : "Remplaçant : aucun joueur, toucher pour affecter";
            return (
              <div aria-label={label} className={`match-pitch-token ${playerId ? "filled" : "empty"}`} key={index}>
                {!readOnly && <button aria-label={label} className="match-pitch-token-hit" onClick={() => setPickingBenchIndex(index)} type="button" />}
                <span aria-hidden="true">{playerId ? initials(nameOf(playerId)) : "+"}</span>
              </div>
            );
          })}
        </div>
        {pickingBenchIndex !== null && (
          <PlayerPicker
            currentPlayerId={bench[pickingBenchIndex] ?? null}
            onClear={() => {
              const current = bench[pickingBenchIndex];
              if (current) void persist(fromPlan(value, removeSubstitute(asPlan(value), current)));
              setPickingBenchIndex(null);
            }}
            onClose={() => setPickingBenchIndex(null)}
            onPick={(playerId) => {
              const player = players.find((candidate) => candidate.id === playerId);
              if (player && value.substitutePlayerIds.length < benchMax) void persist(fromPlan(value, addSubstitute(asPlan(value), player)));
              setPickingBenchIndex(null);
            }}
            // Une place déjà occupée ne propose que « Laisser le poste libre ».
            players={bench[pickingBenchIndex] ? [] : players.filter((player) => !value.substitutePlayerIds.includes(player.id))}
            statusOf={(playerId) => (value.lineup.some((assignment) => assignment.playerId === playerId) ? "déjà titulaire" : null)}
            title="Choisir un remplaçant"
          />
        )}
      </section>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
