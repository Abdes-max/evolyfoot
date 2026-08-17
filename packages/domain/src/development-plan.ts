import type { DiagnosticSummary } from "./diagnostic";
import type { DevelopmentTheme } from "./index";
export interface DevelopmentWeek { week: number; phase: "Découvrir" | "Stabiliser" | "Mettre sous pression" | "Évaluer"; theme: DevelopmentTheme; intention: string; observable: string; }
export interface DevelopmentPlan { title: string; primaryTheme: DevelopmentTheme; secondaryTheme: DevelopmentTheme; explanation: string; weeks: DevelopmentWeek[]; }
const intentions: Record<DevelopmentTheme,string>={"Conserver le ballon":"Multiplier les solutions simples autour du porteur.","Progresser ensemble":"Créer des relations pour avancer sans isoler le porteur.","Finir les actions":"Reconnaître et exploiter le moment pour finir.","Récupérer rapidement":"Agir ensemble dans les premières secondes après la perte."};
export function buildDevelopmentPlan(diagnostic: DiagnosticSummary): DevelopmentPlan {
  if(diagnostic.priorities.length<2) throw new Error("Deux priorités sont nécessaires pour construire le cycle.");
  const primary=diagnostic.priorities[0]; const secondary=diagnostic.priorities[1];
  return { title:`Cycle · ${primary.label}`,primaryTheme:primary.theme,secondaryTheme:secondary.theme,explanation:`${primary.label} est le comportement le plus fragile (${primary.score}/4). ${secondary.label} sera travaillé en soutien.`,weeks:[
    {week:1,phase:"Découvrir",theme:primary.theme,intention:intentions[primary.theme],observable:`Les joueurs identifient le comportement « ${primary.label} ».`},
    {week:2,phase:"Stabiliser",theme:primary.theme,intention:"Répéter le comportement dans des situations variées.",observable:`Le comportement apparaît sans rappel dans 1 action sur 2.`},
    {week:3,phase:"Mettre sous pression",theme:secondary.theme,intention:`Relier ${primary.label.toLowerCase()} et ${secondary.label.toLowerCase()} sous contrainte.`,observable:"L’équipe conserve son intention quand le temps et l’espace diminuent."},
    {week:4,phase:"Évaluer",theme:primary.theme,intention:"Observer les acquis en jeu libre et décider de la suite.",observable:"Le coach peut citer deux progrès et un point à consolider."},
  ]};
}
