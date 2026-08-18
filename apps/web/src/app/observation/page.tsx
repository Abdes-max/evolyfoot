import { ObservationForm } from "./observation-form";

interface ObservationPageProps {
  searchParams?: Promise<{ type?: string | string[] }>;
}

export default async function ObservationPage({ searchParams }: ObservationPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedType = Array.isArray(resolvedSearchParams?.type) ? resolvedSearchParams.type[0] : resolvedSearchParams?.type;
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
