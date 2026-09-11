"use client";

import { useEffect, useState, type FormEvent } from "react";
import { frenchDateLabel, parseDateInputValue, sortChronologically } from "../date-format";

interface Competition {
  id: string;
  name: string;
  dateLabel: string;
  date: string | null;
  result: string | null;
}

interface CompetitionsPanelProps {
  // Libellé de la section et intitulé au singulier (pour les placeholders / aria-label).
  title: string;
  singular: string;
  // Endpoint REST : `${endpoint}` pour GET/POST, `${endpoint}/:id` pour DELETE.
  endpoint: string;
  // Clés de la réponse JSON : liste et élément unique.
  listKey: string;
  itemKey: string;
}

async function readError(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({}));
  return typeof body.error === "string" ? body.error : "Une erreur est survenue.";
}

export function CompetitionsPanel({ title, singular, endpoint, listKey, itemKey }: CompetitionsPanelProps) {
  const [items, setItems] = useState<Competition[]>([]);
  const [name, setName] = useState("");
  // "YYYY-MM-DD" (valeur brute d'un <input type="date">) -- dateLabel en dérive automatiquement
  // à l'envoi, voir add() ci-dessous.
  const [dateInput, setDateInput] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(endpoint);
        const body = await response.json().catch(() => ({}));
        if (!cancelled && response.ok) {
          setItems(body[listKey] ?? []);
        }
      } catch {
        // Section vide si la liste ne charge pas.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [endpoint, listKey]);

  async function add(event: FormEvent) {
    event.preventDefault();
    setAdding(true);
    setError("");
    try {
      const date = parseDateInputValue(dateInput);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          dateLabel: date ? frenchDateLabel(date) : dateInput,
          date: date ? date.toISOString() : null,
          result: result || undefined,
        }),
      });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      const body = await response.json();
      setItems((current) => [body[itemKey], ...current]);
      setName("");
      setDateInput("");
      setResult("");
    } catch {
      setError("Une erreur est survenue.");
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
    try {
      await fetch(`${endpoint}/${id}`, { method: "DELETE" });
    } catch {
      // La liste reflète déjà l'intention ; rien de critique en cas d'échec réseau.
    }
  }

  return (
    <section className="competitions-panel" aria-labelledby={`competitions-${listKey}`}>
      <h2 id={`competitions-${listKey}`}>{title}</h2>
      <form className="competitions-form" onSubmit={add}>
        <input onChange={(event) => setName(event.target.value)} placeholder={`Nom du ${singular}`} value={name} />
        <input aria-label="Date" onChange={(event) => setDateInput(event.target.value)} required type="date" value={dateInput} />
        <input onChange={(event) => setResult(event.target.value)} placeholder="Bilan (optionnel)" value={result} />
        <button disabled={adding} type="submit">
          {adding ? "Ajout…" : "Ajouter"}
        </button>
      </form>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {items.length === 0 ? (
        <p className="competitions-empty">Aucun {singular} pour l’instant.</p>
      ) : (
        <ul className="competitions-list">
          {sortChronologically(items, (item) => (item.date ? new Date(item.date) : null)).map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <span>
                  {item.dateLabel}
                  {item.result ? ` · ${item.result}` : ""}
                </span>
              </div>
              <button aria-label={`Retirer ${item.name}`} onClick={() => remove(item.id)} type="button">
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
