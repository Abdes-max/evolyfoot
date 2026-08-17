"use client";
import { diagnosticCriteria, summarizeDiagnostic, type DiagnosticScores } from "@evolyfoot/domain";
import { useState } from "react";
import Link from "next/link";
const initialScores: DiagnosticScores = { availability: 2, scanning: 2, progression: 2, reactionAfterLoss: 2 };
const levels = ["Rarement", "Par moments", "Souvent", "Naturellement"];
export function DiagnosticForm() {
  const [scores,setScores]=useState(initialScores); const [submitted,setSubmitted]=useState(false); const summary=summarizeDiagnostic(scores);
  return <section className="diagnostic-panel"><div className="diagnostic-scale"><span>1 · Rarement</span><span>4 · Naturellement</span></div>{diagnosticCriteria.map((criterion)=><article className="criterion-card" key={criterion.id}><div><h2>{criterion.label}</h2><p>{criterion.description}</p></div><div className="rating" aria-label={criterion.label}>{levels.map((level,index)=>{const value=index+1;return <button type="button" aria-label={`${criterion.label} : ${level}`} aria-pressed={scores[criterion.id]===value} className={scores[criterion.id]===value?"active":""} onClick={()=>{setScores({...scores,[criterion.id]:value});setSubmitted(false)}} key={level}><strong>{value}</strong><span>{level}</span></button>})}</div></article>)}<button className="continue-button" type="button" onClick={()=>setSubmitted(true)}>Voir mes priorités <span>→</span></button>{submitted&&<section className="diagnostic-result" role="status"><span className="eyebrow">SYNTHÈSE EVOLY</span><h2>Deux priorités pour démarrer</h2><div>{summary.priorities.map((priority)=><article key={priority.criterion}><strong>{priority.label}</strong><span>{priority.theme} · niveau {priority.score}/4</span></article>)}</div><p>Ces priorités serviront à construire le premier cycle de quatre semaines.</p><Link href="/plan">Construire mon cycle →</Link></section>}</section>;
}
