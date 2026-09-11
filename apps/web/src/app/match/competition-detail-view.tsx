"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { parseDateInputValue } from "../date-format";

interface Competition {
  id: string;
  name: string;
  dateLabel: string;
  date: string | null;
  location: string | null;
  description: string | null;
  result: string | null;
}

interface CompetitionDetailViewProps {
  competitionId: string;
  // Endpoint REST : `${endpoint}/:id` pour GET, `${endpoint}/:id/details` pour PATCH,
  // `${endpoint}/:id` pour DELETE -- même principe que CompetitionsPanel.
  endpoint: string;
  itemKey: string;
  singular: string;
  backHref: string;
}

async function readErrorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({}));
  return typeof body.error === "string" ? body.error : "Une erreur est survenue.";
}

// Fiche détail d'un tournoi ou d'un plateau -- même forme que la préparation d'un match
// (match-prep-view.tsx) : en-tête avec statut, panneau « Détails » modifiable (date, lieu,
// description, bilan). Pas de composition ni de convocation ici, contrairement à un match : un
// tournoi/plateau n'a pas de feuille de match individuelle rattachée.
export function CompetitionDetailView({ competitionId, endpoint, itemKey, singular, backHref }: CompetitionDetailViewProps) {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | undefined>(undefined);
  const [item, setItem] = useState<Competition | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const sessionResponse = await fetch("/api/auth/session");
        const sessionBody = await sessionResponse.json().catch(() => ({ educator: null }));
        if (cancelled) {
          return;
        }
        const isAuthenticated = Boolean(sessionBody.educator);
        setAuthenticated(isAuthenticated);
        if (!isAuthenticated) {
          return;
        }

        const response = await fetch(`${endpoint}/${competitionId}`);
        if (!response.ok) {
          setLoadError(await readErrorMessage(response));
          return;
        }
        const body = await response.json();
        const loaded: Competition = body[itemKey];
        if (cancelled) {
          return;
        }
        setItem(loaded);
        setDateInput(loaded.date ? loaded.date.slice(0, 10) : "");
        setLocation(loaded.location ?? "");
        setDescription(loaded.description ?? "");
        setResult(loaded.result ?? "");
      } catch {
        if (!cancelled) {
          setLoadError("Une erreur est survenue.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [competitionId, endpoint, itemKey]);

  async function saveDetails(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveError("");
    try {
      const date = parseDateInputValue(dateInput);
      const response = await fetch(`${endpoint}/${competitionId}/details`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date: date ? date.toISOString() : null,
          location,
          description,
          result,
        }),
      });
      if (!response.ok) {
        setSaveError(await readErrorMessage(response));
        return;
      }
      const body = await response.json();
      const updated: Competition = body[itemKey];
      setItem(updated);
      setDateInput(updated.date ? updated.date.slice(0, 10) : "");
    } catch {
      setSaveError("Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setRemoving(true);
    try {
      await fetch(`${endpoint}/${competitionId}`, { method: "DELETE" });
      router.push(backHref);
    } catch {
      setSaveError("Une erreur est survenue.");
      setRemoving(false);
    }
  }

  if (authenticated === false) {
    return (
      <main className="match-shell">
        <section className="match-auth-required" role="status">
          <p>
            Connecte-toi pour voir ce {singular}. <Link className="inline-cta" href="/connexion">Se connecter →</Link>
          </p>
        </section>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="match-shell">
        <section className="match-content">
          <p className="field-error" role="alert">
            {loadError}
          </p>
          <Link className="back-link" href={backHref}>
            Retour
          </Link>
        </section>
      </main>
    );
  }

  if (!item) {
    return <main className="match-shell" />;
  }

  const isPast = item.date ? new Date(item.date).getTime() < new Date().getTime() : false;

  return (
    <main className="match-shell">
      <header className="page-header match-header">
        <div>
          <span className="eyebrow light">{isPast ? `${singular.toUpperCase()} PASSÉ` : `${singular.toUpperCase()} À VENIR`}</span>
          <h1 title={item.name}>{item.name}</h1>
          <p title={item.dateLabel}>{item.dateLabel}</p>
        </div>
      </header>

      <section className="match-content">
        <div className="match-slot-panel">
          <form className="match-details-form" onSubmit={saveDetails}>
            <h2>Détails</h2>
            <label>
              <span>Date</span>
              <input onChange={(event) => setDateInput(event.target.value)} type="date" value={dateInput} />
            </label>
            <label>
              <span>Lieu</span>
              <input
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Ex. Stade Marius Requier, Aix-en-Provence"
                value={location}
              />
            </label>
            <label>
              <span>Description</span>
              <textarea onChange={(event) => setDescription(event.target.value)} value={description} />
            </label>
            <label>
              <span>Bilan</span>
              <input onChange={(event) => setResult(event.target.value)} placeholder="Ex. 2 victoires, 1 nul" value={result} />
            </label>
            <button className="match-details-save" disabled={saving} type="submit">
              {saving ? "Enregistrement…" : "Enregistrer les détails"}
            </button>
          </form>

          {saveError && (
            <p className="field-error" role="alert">
              {saveError}
            </p>
          )}

          <button className="competition-detail-remove" disabled={removing} onClick={remove} type="button">
            {removing ? "…" : `Retirer ce ${singular}`}
          </button>
        </div>
      </section>

      <Link className="back-link match-back-link" href={backHref}>
        Retour aux matchs
      </Link>
    </main>
  );
}
