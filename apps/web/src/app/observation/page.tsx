import { ObservationForm } from "./observation-form";

interface ObservationPageProps {
  searchParams?: { type?: string | string[] };
}

export default function ObservationPage({ searchParams }: ObservationPageProps) {
  const requestedType = Array.isArray(searchParams?.type) ? searchParams.type[0] : searchParams?.type;
  const initialEventType = requestedType === "match" ? "match" : "training";

  return (
    <main className="observation-shell">
      <header className="observation-header">
        <span className="eyebrow light">OBSERVATION RAPIDE</span>
        <h1>Ce que tu as vu aujourd&apos;hui.</h1>
        <p>Garde une trace simple des comportements collectifs et des joueurs à retenir.</p>
      </header>
      <ObservationForm initialEventType={initialEventType} />
    </main>
  );
}
