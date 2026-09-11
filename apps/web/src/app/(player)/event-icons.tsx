// Petites icônes inline (pas de dépendance externe) pour les fiches détail d'événement -- match ou
// séance d'entraînement -- devant chaque information factuelle (horaire, lieu, description),
// comme sur l'exemple fourni par l'utilisateur (app de club de référence).
function IconBase({ children }: { children: React.ReactNode }) {
  return (
    <svg aria-hidden="true" fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="15">
      {children}
    </svg>
  );
}

export function ClockIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </IconBase>
  );
}

export function PinIcon() {
  return (
    <IconBase>
      <path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.3" />
    </IconBase>
  );
}

export function NoteIcon() {
  return (
    <IconBase>
      <path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5M8 13h8M8 17h5" />
    </IconBase>
  );
}
