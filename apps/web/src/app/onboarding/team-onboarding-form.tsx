"use client";
import { ageGroups, validateTeamProfile, type TeamProfile, type TrainingDay } from "@evolyfoot/domain";
import { useState, type FormEvent } from "react";
import Link from "next/link";
const days: TrainingDay[] = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const initialProfile: TeamProfile = { name: "", ageGroup: "U12", playerCount: 14, sessionsPerWeek: 2, trainingDays: [] };
export function TeamOnboardingForm() {
  const [profile, setProfile] = useState(initialProfile); const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? validateTeamProfile(profile) : {}; const complete = submitted && !Object.keys(errors).length;
  const toggleDay = (day: TrainingDay) => setProfile((current) => ({ ...current, trainingDays: current.trainingDays.includes(day) ? current.trainingDays.filter((item) => item !== day) : [...current.trainingDays, day] }));
  const submit = (event: FormEvent) => { event.preventDefault(); setSubmitted(true); };
  return <form className="team-form" onSubmit={submit} noValidate><header><span className="eyebrow">PROFIL DE L’ÉQUIPE</span><h2>Ta saison en quelques repères</h2><p>Tu pourras modifier ces informations à tout moment.</p></header>
    <label>Nom de l’équipe<input value={profile.name} onChange={(e) => setProfile({...profile,name:e.target.value})} placeholder="Ex. FC Horizon" />{errors.name && <small className="field-error">{errors.name}</small>}</label>
    <fieldset><legend>Catégorie</legend><div className="choice-grid">{ageGroups.map((group) => <button type="button" className={profile.ageGroup === group ? "choice active":"choice"} aria-pressed={profile.ageGroup === group} onClick={() => setProfile({...profile,ageGroup:group})} key={group}>{group}</button>)}</div></fieldset>
    <div className="form-row"><label>Nombre de joueurs<input type="number" min="6" max="30" value={profile.playerCount} onChange={(e) => setProfile({...profile,playerCount:Number(e.target.value)})}/>{errors.playerCount && <small className="field-error">{errors.playerCount}</small>}</label><label>Séances par semaine<select value={profile.sessionsPerWeek} onChange={(e) => setProfile({...profile,sessionsPerWeek:Number(e.target.value)})}>{[1,2,3,4].map((value)=><option value={value} key={value}>{value} séance{value>1?"s":""}</option>)}</select></label></div>
    <fieldset><legend>Jours d’entraînement</legend><p className="field-hint">Sélectionne {profile.sessionsPerWeek} jour{profile.sessionsPerWeek>1?"s":""}.</p><div className="day-grid">{days.map((day)=><button type="button" className={profile.trainingDays.includes(day)?"day active":"day"} aria-pressed={profile.trainingDays.includes(day)} onClick={()=>toggleDay(day)} key={day}>{day.slice(0,3)}</button>)}</div>{errors.trainingDays && <small className="field-error">{errors.trainingDays}</small>}</fieldset>
    {complete && <div className="success-message" role="status"><strong>Équipe prête !</strong><span>La prochaine étape sera le diagnostic initial.</span><Link href="/diagnostic">Commencer le diagnostic →</Link></div>}<button className="continue-button" type="submit">Valider mon équipe <span>→</span></button><Link className="back-link" href="/">Retour au tableau de bord</Link></form>;
}
