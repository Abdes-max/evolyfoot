import {
  buildTeamStatsReport,
  playerEvaluationAspectLabels,
  playerEvaluationAspects,
  playerEvaluationMaxScore,
  type DiagramTokenRole,
  type PlayerEvaluationScores,
  type PlayerSeasonTotals,
  type TacticalDiagram,
  type TeamStats,
  type TrainingSession,
} from "@evolyfoot/domain";
import { printToFileAsync } from "expo-print";
import { isAvailableAsync, shareAsync } from "expo-sharing";
import { kindLabels } from "./exercise-labels";

// Les PDF sont imprimés sur fond blanc, comme ceux du web (impression du navigateur) : encre
// sombre, couleurs réservées au schéma.
const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const tokenFill: Record<DiagramTokenRole, string> = { attacker: "#2fd4ff", defender: "#ff8f7a", goalkeeper: "#ffffff" };
const labelFill: Record<DiagramTokenRole, string> = { attacker: "#062330", defender: "#3a140c", goalkeeper: "#152a22" };

export function diagramSvg(diagram: TacticalDiagram): string {
  const zones = diagram.zones
    .map((zone) => `<rect x="${zone.x}" y="${zone.y}" width="${zone.width}" height="${zone.height}" rx="8" fill="none" stroke="#2c463b" stroke-width="1.5" stroke-dasharray="5 5"/>`)
    .join("");
  const arrows = diagram.arrows
    .map((arrow) => `<path d="M${arrow.x1} ${arrow.y1} L${arrow.x2} ${arrow.y2}" stroke="#2fd4ff" stroke-width="2.2" fill="none" marker-end="url(#head)"/>`)
    .join("");
  const tokens = diagram.tokens
    .map(
      (token) =>
        `<circle cx="${token.x}" cy="${token.y}" r="${token.role === "goalkeeper" ? 12 : 13}" fill="${tokenFill[token.role]}"/>` +
        `<text x="${token.x}" y="${token.y + 4}" text-anchor="middle" font-size="9" font-weight="800" fill="${labelFill[token.role]}">${escapeHtml(token.label)}</text>`,
    )
    .join("");
  return `<svg viewBox="0 0 ${diagram.width} ${diagram.height}" width="100%"><defs><marker id="head" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#2fd4ff"/></marker></defs><rect x="4" y="4" width="${diagram.width - 8}" height="${diagram.height - 8}" rx="14" fill="#152a22" stroke="#2c463b" stroke-width="2"/>${zones}${arrows}${tokens}</svg>`;
}

function page(title: string, body: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #10141c; margin: 28px; font-size: 12px; line-height: 1.5; }
    h1 { font-size: 22px; margin: 0 0 4px; } h2 { font-size: 15px; margin: 18px 0 6px; } .muted { color: #5f6a7c; }
    .block { break-inside: avoid; border: 1px solid #d8dde6; border-radius: 10px; padding: 12px 14px; margin-top: 12px; }
    .block svg { max-width: 360px; display: block; margin: 8px 0; } dt { font-weight: 800; margin-top: 6px; } dd { margin: 0; }
    footer { margin-top: 24px; color: #5f6a7c; font-size: 10px; }
  </style></head><body>${body}<footer>EvolyFoot · ${escapeHtml(new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }))}</footer></body></html>`;
}

export function sessionHtml(session: TrainingSession, meetingLabel: string): string {
  const total = session.blocks.reduce((sum, block) => sum + block.durationMinutes, 0);
  const blocks = session.blocks
    .map(
      (block, index) => `<section class="block">
        <h2>${index + 1}. ${escapeHtml(block.activity.title)} <span class="muted">· ${escapeHtml(kindLabels[block.activity.kind])} · ${block.durationMinutes} min</span></h2>
        <p>${escapeHtml(block.activity.objective)}</p>
        ${block.activity.photo ? "" : diagramSvg(block.activity.diagram)}
        <dl><dt>Organisation</dt><dd>${escapeHtml(block.activity.organization)}</dd>
        <dt>Consigne</dt><dd>${escapeHtml(block.activity.instruction)}</dd>
        <dt>À observer</dt><dd>${escapeHtml(block.activity.observable)}</dd></dl>
      </section>`,
    )
    .join("");
  return page(
    session.title,
    `<h1>${escapeHtml(session.title)}</h1>
    <p class="muted">${escapeHtml(session.theme)} · ${session.playerCount} joueurs · ${total} min · ${escapeHtml(meetingLabel)}</p>
    <p>${escapeHtml(session.intention)}</p>${blocks}`,
  );
}

export function statsHtml(stats: TeamStats, teamName: string): string {
  const rows: Array<[string, string]> = [
    ["Séances", String(stats.trainingCount)],
    ["Matchs", `${stats.matchCount} (${stats.matchesPlayed} joués, ${stats.matchesScheduled} à venir)`],
    ["Tournois", String(stats.tournamentCount)],
    ["Plateaux", String(stats.plateauCount)],
    ["Présence à l’entraînement", stats.trainingAttendance.total > 0 ? `${stats.trainingAttendance.rate} %` : "non relevée"],
    ["Présence en match", stats.matchAttendance.total > 0 ? `${stats.matchAttendance.rate} %` : "non relevée"],
  ];
  return page(
    "Rapport de saison",
    `<h1>Rapport de saison</h1><p class="muted">${escapeHtml(teamName)}</p>
    <section class="block"><dl>${rows.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join("")}</dl></section>
    <h2>Synthèse</h2><ul>${buildTeamStatsReport(stats)
      .map((line) => `<li>${escapeHtml(line)}</li>`)
      .join("")}</ul>`,
  );
}

// Joueur tel que renvoyé par `GET /api/roster`.
export interface ReportPlayer {
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

export function playerReportHtml(player: ReportPlayer, teamName: string, season: PlayerSeasonTotals, scores: PlayerEvaluationScores | null, evaluationCount: number): string {
  const identity = [player.position, player.jerseyNumber ? `N° ${player.jerseyNumber}` : null, player.preferredFoot ? `Pied ${player.preferredFoot}` : null, teamName]
    .filter(Boolean)
    .map((part) => escapeHtml(String(part)))
    .join(" · ");
  const bars = scores
    ? playerEvaluationAspects
        .map(
          (aspect) =>
            `<tr><td>${escapeHtml(playerEvaluationAspectLabels[aspect])}</td><td><div style="background:#e6eaf0;border-radius:4px;height:8px;width:220px"><div style="background:#2fd4ff;border-radius:4px;height:8px;width:${(scores[aspect] / playerEvaluationMaxScore) * 220}px"></div></div></td><td><strong>${scores[aspect]}</strong>/${playerEvaluationMaxScore}</td></tr>`,
        )
        .join("")
    : "";
  return page(
    `Bilan de ${player.name}`,
    `${player.photo?.startsWith("data:image/") ? `<img alt="" src="${escapeHtml(player.photo)}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;float:right">` : ""}<h1>Bilan de ${escapeHtml(player.name)}</h1><p class="muted">${identity}</p>
    <section class="block"><dl><dt>Matchs joués</dt><dd>${season.matches}</dd><dt>Buts</dt><dd>${season.goals}</dd><dt>Passes décisives</dt><dd>${season.assists}</dd></dl></section>
    <h2>Dernière évaluation de l’éducateur</h2>${scores ? `<table>${bars}</table><p class="muted">${evaluationCount} évaluation${evaluationCount > 1 ? "s" : ""} enregistrée${evaluationCount > 1 ? "s" : ""}.</p>` : "<p class=\"muted\">Pas encore d’évaluation.</p>"}
    ${player.strengths ? `<h2>Points forts</h2><p>${escapeHtml(player.strengths)}</p>` : ""}
    ${player.workAreas ? `<h2>Axes de travail</h2><p>${escapeHtml(player.workAreas)}</p>` : ""}`,
  );
}

// Génère le PDF puis ouvre la feuille de partage (enregistrer, envoyer, imprimer).
export async function sharePdf(html: string, title: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { uri } = await printToFileAsync({ html });
    if (!(await isAvailableAsync())) {
      return { ok: false, error: "Le partage n’est pas disponible sur cet appareil." };
    }
    await shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: title });
    return { ok: true };
  } catch {
    return { ok: false, error: "Le PDF n’a pas pu être créé." };
  }
}
