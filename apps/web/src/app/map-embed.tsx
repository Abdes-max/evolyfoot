"use client";

import { useSyncExternalStore } from "react";

const consentKey = "evolyfoot-cartes-google";
const consentEvent = "evolyfoot-cartes-google";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(consentEvent, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(consentEvent, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readConsent(): boolean {
  try {
    return window.localStorage.getItem(consentKey) === "oui";
  } catch {
    return false;
  }
}

function giveConsent() {
  try {
    window.localStorage.setItem(consentKey, "oui");
  } catch {
    // Stockage indisponible : la carte ne restera pas mémorisée.
  }
  window.dispatchEvent(new Event(consentEvent));
}

// Plan de l'adresse : Google reçoit l'adresse et l'IP du visiteur, donc rien n'est chargé avant son
// accord. L'accord vaut pour toutes les cartes de ce navigateur.
export function MapEmbed({ address, compact = false }: { address: string; compact?: boolean }) {
  const consented = useSyncExternalStore(subscribe, readConsent, () => false);
  const className = compact ? "map-embed compact" : "map-embed";

  if (!consented) {
    return (
      <div className={`${className} map-embed-consent`}>
        <p>La carte est fournie par Google, qui reçoit l’adresse affichée et ton adresse IP.</p>
        <button onClick={giveConsent} type="button">
          Afficher les cartes
        </button>
      </div>
    );
  }

  const src = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=15&output=embed`;
  return (
    <div className={className}>
      <iframe loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={src} title={`Plan : ${address}`} />
    </div>
  );
}
