"use client";

import { useEffect, useState } from "react";

// Logo de l'équipe en tête de l'export PDF : invisible à l'écran, affiché seulement à l'impression.
export function PrintTeamLogo() {
  const [logo, setLogo] = useState<{ src: string; name: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/team")
      .then((response) => response.json())
      .then((body) => {
        if (!cancelled && body?.profile?.logo) setLogo({ src: body.profile.logo, name: body.profile.name ?? "" });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  // eslint-disable-next-line @next/next/no-img-element
  return logo ? <img alt={`Logo ${logo.name}`} className="print-team-logo" src={logo.src} /> : null;
}
