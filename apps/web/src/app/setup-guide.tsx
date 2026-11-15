"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type StepId = "players" | "season" | "match" | "evaluation" | "session" | "observation" | "result";

interface Guide {
  steps: { id: StepId; done: boolean }[];
  done: number;
  total: number;
  dismissed: boolean;
}

export const setupGuideSteps: Record<StepId, { label: string; href: string }> = {
  players: { label: "Ajoute tes joueurs", href: "/equipe" },
  season: { label: "Lance ta saison", href: "/saison" },
  match: { label: "Ajoute un match à venir", href: "/match" },
  evaluation: { label: "Évalue tes joueurs", href: "/equipe" },
  session: { label: "Crée une séance d'entraînement", href: "/seances" },
  observation: { label: "Observe une séance et demande un ajustement", href: "/observation" },
  result: { label: "Marque un match terminé et renseigne les stats", href: "/match" },
};

// Guide de configuration du coach : bouton flottant « x/7 » qui ouvre la liste des étapes, cochées
// automatiquement d'après les données de l'équipe. Invisible pour tout autre compte (l'API répond 403).
export function SetupGuide() {
  const pathname = usePathname();
  const [guide, setGuide] = useState<Guide | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/setup-guide")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!cancelled && body?.guide) {
          setGuide(body.guide as Guide);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname, open]);

  const hide = useCallback(async () => {
    setOpen(false);
    setGuide((current) => (current ? { ...current, dismissed: true } : current));
    await fetch("/api/setup-guide/dismiss", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dismissed: true }),
    }).catch(() => undefined);
  }, []);

  if (!guide || guide.dismissed) {
    return null;
  }

  const complete = guide.done === guide.total;
  const percent = Math.round((guide.done / guide.total) * 100);

  return (
    <div className="setup-guide">
      {open ? (
        <section aria-label="Guide de configuration" className="setup-guide-card">
          <header>
            <h2>Guide de configuration</h2>
            <button aria-label="Fermer" onClick={() => setOpen(false)} type="button">
              ×
            </button>
          </header>
          <p>{complete ? "Bravo, ton espace est prêt !" : "Mets ton espace en route, étape par étape"}</p>
          <ul>
            {guide.steps.map((step) => (
              <li className={step.done ? "done" : ""} key={step.id}>
                <Link href={setupGuideSteps[step.id].href} onClick={() => setOpen(false)}>
                  <span aria-hidden="true" className="setup-guide-check">
                    {step.done ? "✓" : ""}
                  </span>
                  <span className="setup-guide-label">{setupGuideSteps[step.id].label}</span>
                  <span aria-hidden="true">›</span>
                </Link>
              </li>
            ))}
          </ul>
          <footer>
            <div aria-hidden="true" className="setup-guide-bar">
              <span style={{ width: `${percent}%` }} />
            </div>
            <strong>
              {guide.done}/{guide.total}
            </strong>
            <button onClick={hide} type="button">
              {complete ? "Terminer" : "Masquer"}
            </button>
          </footer>
        </section>
      ) : null}
      <button aria-expanded={open} className="setup-guide-toggle" onClick={() => setOpen((value) => !value)} type="button">
        <span aria-hidden="true">🚀</span> Guide de configuration {guide.done}/{guide.total}
      </button>
    </div>
  );
}
