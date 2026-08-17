import { TeamOnboardingForm } from "./team-onboarding-form";
import Link from "next/link";
export default function OnboardingPage() {
  return <main className="onboarding-shell"><section className="onboarding-intro"><Link className="onboarding-brand" href="/"><span className="brand-mark">E</span> EvolyFoot</Link><div><span className="eyebrow light">ÉTAPE 1 SUR 3</span><h1>Commençons par ton équipe.</h1><p>Ces repères permettent d’adapter le plan de progression à ta réalité terrain.</p></div><ol><li className="current">1 · Ton équipe</li><li>2 · Diagnostic initial</li><li>3 · Premier cycle</li></ol></section><section className="onboarding-panel"><TeamOnboardingForm /></section></main>;
}
