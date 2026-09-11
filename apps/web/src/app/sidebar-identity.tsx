"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Educator {
  id: string;
  email: string;
  displayName: string;
  emailVerified?: boolean;
}

interface TeamProfile {
  name: string;
  ageGroup: string;
  gameFormat: number;
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
  // Le nombre de joueurs affiché ici doit refléter l'effectif nominatif réel (`/equipe`), pas
  // `Team.playerCount` -- un chiffre saisi une fois à l'onboarding, avant que l'effectif nominatif
  // n'existe (voir roadmap.md, phase 2), qui se désynchronise dès qu'un joueur est ajouté/retiré.
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");

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
          const [teamResponse, rosterResponse] = await Promise.all([fetch("/api/team"), fetch("/api/roster")]);
          const teamBody = await teamResponse.json().catch(() => ({ profile: null }));
          const rosterBody = await rosterResponse.json().catch(() => ({ players: [] }));
          if (!cancelled) {
            setTeam(teamBody.profile ?? null);
            setPlayerCount(Array.isArray(rosterBody.players) ? rosterBody.players.length : 0);
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

  async function resendVerification() {
    setResendState("sending");
    try {
      await fetch("/api/auth/resend-verification", { method: "POST" });
    } finally {
      setResendState("sent");
    }
  }

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
            <span>
              Foot à {team.gameFormat} · {playerCount ?? 0} joueur{(playerCount ?? 0) > 1 ? "s" : ""}
            </span>
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
        <Link aria-label="Ouvrir mon profil" className="coach-link" href="/profil">
          <span className="avatar">{initials(educator.displayName)}</span>
          <div>
            <strong>{educator.displayName}</strong>
            <span>Voir mon profil</span>
          </div>
        </Link>
        <button aria-label="Se déconnecter" onClick={logout} type="button">
          Déconnexion
        </button>
      </div>
      {educator.emailVerified === false && (
        <div className="email-reminder">
          <span>Confirme ton adresse e-mail : un lien t’a été envoyé à l’inscription.</span>
          {resendState === "sent" ? (
            <span>Nouveau lien envoyé.</span>
          ) : (
            <button disabled={resendState === "sending"} onClick={resendVerification} type="button">
              {resendState === "sending" ? "Envoi…" : "Renvoyer le lien"}
            </button>
          )}
        </div>
      )}
    </>
  );
}
