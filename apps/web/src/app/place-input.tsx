"use client";

import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { MapEmbed } from "./map-embed";

const searchDelayMs = 300;
const minQueryLength = 3;
const mapDelayMs = 600;

interface PlaceInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

// Champ « Lieu » : propose des adresses pendant la frappe, sans obliger à en choisir une. Un stade
// annexe ou un terrain sans adresse se saisit toujours librement.
export function PlaceInput({ value, onChange, disabled = false }: PlaceInputProps) {
  const listId = useId();
  const [places, setPlaces] = useState<readonly string[]>([]);
  const [typing, setTyping] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  // Adresse de l’aperçu, posée un instant après la dernière frappe : la carte apparaît pendant que
  // le champ a encore le focus, et non au blur -- sinon elle décale la page sous le clic qui suit
  // (le bouton visé glisse et le clic est perdu).
  const [mapAddress, setMapAddress] = useState(value.trim());

  useEffect(() => {
    const timer = setTimeout(() => setMapAddress(value.trim()), mapDelayMs);
    return () => clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    if (!typing || value.trim().length < minQueryLength) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/places?q=${encodeURIComponent(value.trim())}`, { signal: controller.signal });
        const body = await response.json().catch(() => ({ places: [] }));
        setPlaces(body.places ?? []);
        setHighlighted(-1);
      } catch {
        // Requête annulée par la frappe suivante, ou réseau indisponible : la saisie reste libre.
      }
    }, searchDelayMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [typing, value]);

  const open = typing && places.length > 0 && value.trim().length >= minQueryLength;

  function choose(place: string) {
    onChange(place);
    setTyping(false);
    setPlaces([]);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setHighlighted((current) => (current + delta + places.length) % places.length);
    } else if (event.key === "Enter" && highlighted >= 0) {
      event.preventDefault();
      choose(places[highlighted]!);
    } else if (event.key === "Escape") {
      setTyping(false);
    }
  }

  return (
    <div className="place-input">
      <input
        aria-activedescendant={open && highlighted >= 0 ? `${listId}-${highlighted}` : undefined}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open}
        autoComplete="off"
        disabled={disabled}
        onBlur={() => setTyping(false)}
        onChange={(event) => {
          onChange(event.target.value);
          setTyping(true);
        }}
        onKeyDown={onKeyDown}
        placeholder="Cherche un stade ou une adresse"
        role="combobox"
        value={value}
      />
      {open && (
        <ul className="place-input-list" id={listId} role="listbox">
          {places.map((place, index) => (
            <li
              aria-selected={index === highlighted}
              className={index === highlighted ? "active" : undefined}
              id={`${listId}-${index}`}
              key={place}
              onMouseDown={(event) => {
                // Avant le blur du champ, qui fermerait la liste.
                event.preventDefault();
                choose(place);
              }}
              role="option"
            >
              {place}
            </li>
          ))}
        </ul>
      )}
      {mapAddress && <MapEmbed address={mapAddress} compact />}
    </div>
  );
}
