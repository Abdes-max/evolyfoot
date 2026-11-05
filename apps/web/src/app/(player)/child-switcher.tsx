"use client";

import { useEffect, useState } from "react";

interface Child {
  playerId: string;
  name: string;
  displayed: boolean;
}

// Choix de l’enfant suivi, visible seulement quand le compte en suit plusieurs : toute la page
// (carte, calendrier, messages) se recharge sur l’enfant choisi.
export function ChildSwitcher() {
  const [children, setChildren] = useState<Child[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/joueur/enfants").catch(() => null);
      const body = response?.ok ? await response.json().catch(() => null) : null;
      if (!cancelled) setChildren(Array.isArray(body?.children) ? body.children : []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (children.length < 2) return null;

  async function choose(playerId: string) {
    const response = await fetch("/api/joueur/enfants", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId }),
    }).catch(() => null);
    if (response?.ok) window.location.reload();
  }

  return (
    <nav aria-label="Enfant suivi" className="child-switcher">
      {children.map((child) => (
        <button
          aria-current={child.displayed ? "true" : undefined}
          className={child.displayed ? "child-switcher-chip active" : "child-switcher-chip"}
          key={child.playerId}
          onClick={() => (child.displayed ? undefined : void choose(child.playerId))}
          type="button"
        >
          {child.name}
        </button>
      ))}
    </nav>
  );
}
