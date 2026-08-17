import Link from "next/link";
import { DiagnosticForm } from "./diagnostic-form";
export default function DiagnosticPage() { return <main className="diagnostic-shell"><header className="diagnostic-header"><Link className="onboarding-brand" href="/"><span className="brand-mark">E</span> EvolyFoot</Link><div><span className="eyebrow light">ÉTAPE 2 SUR 3</span><h1>Où en est ton équipe aujourd’hui ?</h1><p>Base-toi sur les deux ou trois dernières séances. Il n’y a pas de mauvaise réponse.</p></div></header><DiagnosticForm /></main>; }
