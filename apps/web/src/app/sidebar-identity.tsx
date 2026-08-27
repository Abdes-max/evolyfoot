"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Educator {
  id: string;
  email: string;
  displayName: string;
}

interface TeamProfile {
  name: string;
  ageGroup: string;
  playerCount: number;
}

function initials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export function SidebarIdentity() {
  const [educator, setEducator] = useState<Educator | null | undefined>(undefined);
  const [team, setTeam] = useState<TeamProfile | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const sessionResponse = await fetch("/api/auth/session");
        const sessionBody = await sessionResponse.json().catch(() => ({ educator: null }));
        if (cancelled) {
          return;
        }
        setEducator(sessionBody.educator ?? null);

        if (sessionBody.educator) {
          const teamResponse = await fetch("/api/team");
          const teamBody = await teamResponse.json().catch(() => ({ profile: null }));
          if (!cancelled) {
            setTeam(teamBody.profile ?? null);
          }
        }
      } catch {
        if (!cancelled) {
          setEducator(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/connexion";
    }
  }

  if (educator === undefined) {
    return (
      <>
        <div aria-hidden="true" className="season-card" />
        <div aria-hidden="true" className="coach" />
      </>
    );
  }

  if (educator === null) {
    return (
      <>
        <div className="season-card">
          <span className="eyebrow">TON ÉQUIPE</span>
          <strong>Pas encore connecté</strong>
          <Link className="text-button" href="/connexion">
            Se connecter →
          </Link>
        </div>
        <div className="coach">
          <span className="avatar">?</span>
          <div>
            <strong>Non connecté</strong>
            <span>Éducateur</span>
          </div>
          <Link className="text-button" href="/connexion">
            Se connecter
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="season-card">
        <span className="eyebrow">SAISON 2026–27</span>
        {team ? (
          <>
            <strong>
              {team.name} · {team.ageGroup}
            </strong>
            <span>{team.playerCount} joueurs</span>
          </>
        ) : (
          <>
            <strong>Pas encore d’équipe</strong>
            <Link className="text-button" href="/onboarding">
              Configurer mon équipe →
            </Link>
          </>
        )}
      </div>
      <div className="coach">
        <span className="avatar">{initials(educator.displayName)}</span>
        <div>
          <strong>{educator.displayName}</strong>
          <span>Éducateur</span>
        </div>
        <button aria-label="Se déconnecter" onClick={logout} type="button">
          Déconnexion
        </button>
      </div>
    </>
  );
}
