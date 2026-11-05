"use client";

import Link from "next/link";
import { NotificationBell } from "../notification-bell";
import { ChildSwitcher } from "./child-switcher";
import { playerLogout } from "./joueur/use-player-dashboard";

export function PlayerSpaceHeader() {
  return (
    <header className="player-space-header">
      <Link className="onboarding-brand" href="/joueur">
        <span className="brand-mark">EV</span> EvolyFoot
      </Link>
      <ChildSwitcher />
      <NotificationBell />
      <button className="player-space-logout" onClick={playerLogout} type="button">
        Se déconnecter
      </button>
    </header>
  );
}
