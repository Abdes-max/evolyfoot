"use client";

import { PrintTeamLogo } from "./print-team-logo";

// Le PDF passe par l'impression du navigateur, qui propose « Enregistrer au format PDF ».
export function PrintButton({ label }: { label: string }) {
  return (
    <>
      <PrintTeamLogo />
      <button className="session-print" onClick={() => window.print()} type="button">
        {label}
      </button>
    </>
  );
}
