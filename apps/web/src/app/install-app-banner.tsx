"use client";

import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { storeLinks } from "./(marketing)/store-badges";
import { installBannerStorageKey, installTargetForPath, shouldOfferInstall } from "./install-app";
import "./install-app-banner.css";

const appNames = { coach: "EvolyFoot Coach", player: "EvolyFoot Player" } as const;

// Rien ne change tout seul : la bannière se masque par l'état local.
function subscribeNever(): () => void {
  return () => undefined;
}

function readDismissed(): string | null {
  try {
    return window.localStorage.getItem(installBannerStorageKey);
  } catch {
    return null;
  }
}

// Bandeau en haut des pages sur iPhone : propose l'app mobile (App Store). « Plus tard » le masque 14 jours.
export function InstallAppBanner() {
  const pathname = usePathname() ?? "/";
  const [hidden, setHidden] = useState(false);
  // Lu côté navigateur seulement : `false` au rendu serveur, donc pas de décalage à l'hydratation.
  const offered = useSyncExternalStore(
    subscribeNever,
    () => {
      const standalone =
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
      return shouldOfferInstall({ userAgent: window.navigator.userAgent, standalone, pathname, dismissedAt: readDismissed(), now: Date.now() });
    },
    () => false,
  );

  if (!offered || hidden) return null;
  const target = installTargetForPath(pathname);

  function dismiss() {
    try {
      window.localStorage.setItem(installBannerStorageKey, String(Date.now()));
    } catch {
      // Sans stockage, la bannière reste masquée jusqu'au prochain chargement.
    }
    setHidden(true);
  }

  return (
    <aside aria-label={`Installer ${appNames[target]}`} className="install-banner">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" className="install-banner-icon" height={40} src="/icon.svg" width={40} />
      <div className="install-banner-text">
        <strong>{appNames[target]}</strong>
        <span>L’application iPhone, plus rapide et avec les notifications.</span>
      </div>
      <a className="install-banner-action" href={storeLinks[target].appStore} rel="noopener" target="_blank">
        Installer
      </a>
      <button aria-label="Plus tard" className="install-banner-close" onClick={dismiss} type="button">
        ×
      </button>
    </aside>
  );
}
