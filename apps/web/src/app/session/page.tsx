import {
  buildDevelopmentPlan,
  generateTrainingSession,
  summarizeDiagnostic,
} from "@evolyfoot/domain";
import Link from "next/link";
import { SessionBuilder } from "./session-builder";

const plan = buildDevelopmentPlan(
  summarizeDiagnostic({
    availability: 3,
    scanning: 2,
    progression: 4,
    reactionAfterLoss: 1,
  }),
);

const initialSession = generateTrainingSession(plan.weeks[0], "U12", 14);

export default function SessionPage() {
  return (
    <main className="session-shell">
      <header className="session-header">
        <Link className="onboarding-brand" href="/"><span className="brand-mark">E</span> EvolyFoot</Link>
        <span className="eyebrow light">SÉANCE 1 · SEMAINE 1</span>
        <h1>Prépare ta première séance.</h1>
        <p>{initialSession.intention}</p>
      </header>
      <SessionBuilder initialSession={initialSession} />
    </main>
  );
}
