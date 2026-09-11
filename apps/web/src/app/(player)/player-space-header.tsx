"use client";

import Link from "next/link";
import { playerLogout } from "./joueur/use-player-dashboard";

export function PlayerSpaceHeader() {
  return (
    <header className="player-space-header">
      <Link className="onboarding-brand" href="/joueur">
        <span className="brand-mark">E</span> EvolyFoot
      </Link>
      <button className="player-space-logout" onClick={playerLogout} type="button">
        Se déconnecter
      </button>
    </header>
  );
}
